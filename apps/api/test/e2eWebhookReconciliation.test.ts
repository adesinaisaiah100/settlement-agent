import test from 'node:test';
import assert from 'node:assert/strict';
import { 
  verifyStripeSignature, 
  generateTestStripeSignature, 
  ingestStripePayoutEvent, 
  StripeWebhookEvent 
} from '../src/lib/gateways/stripeWebhookHandler';
import { normalizeShopifyOrder, ShopifyOrderPayload } from '../src/lib/gateways/shopifyNormalizer';
import { DirectGatewayTransaction } from '../src/lib/gateways/twoBucketClassifier';
import { validateMathGate } from '../src/gates/mathGate';
import { SettlementPersistenceService, memoryDb } from '../src/db/persistence';
import { COA } from '@settlement-agent/shared';

test('Phase 5: Gateway Webhook & Live E2E Drill Test Suite', async (t) => {
  const persistence = new SettlementPersistenceService();
  persistence.clear();

  const TEST_SECRET = 'whsec_test_secret_for_cpa_settlement_9988';

  // --------------------------------------------------------------------------
  // TEST 1: Stripe Signature Verification & Tamper Protection
  // --------------------------------------------------------------------------
  await t.test('Test 1: Stripe HMAC-SHA256 signature verification & anti-tamper check', () => {
    const rawPayload = JSON.stringify({ id: 'evt_test_1', type: 'payout.paid' });
    const validSignature = generateTestStripeSignature(rawPayload, TEST_SECRET);

    // Valid check
    const isValid = verifyStripeSignature(rawPayload, validSignature, TEST_SECRET);
    assert.equal(isValid, true, 'Valid signature must be verified successfully');

    // Tampered payload check
    const tamperedPayload = JSON.stringify({ id: 'evt_test_1', type: 'payout.paid', hacked: true });
    const isTamperedValid = verifyStripeSignature(tamperedPayload, validSignature, TEST_SECRET);
    assert.equal(isTamperedValid, false, 'Tampered payload must fail signature verification');

    // Wrong secret check
    const isWrongSecretValid = verifyStripeSignature(rawPayload, validSignature, 'wrong_secret');
    assert.equal(isWrongSecretValid, false, 'Invalid secret must fail signature verification');
  });

  // --------------------------------------------------------------------------
  // TEST 2: Two-Bucket Ingestion (Bucket A Shopify Orders + Bucket B Stripe Dispute)
  // --------------------------------------------------------------------------
  await t.test('Test 2: Two-Bucket Transaction Classifier & Math Gate Equilibrium', () => {
    // 2 Shopify Orders (Bucket A: Order-Linked)
    const rawShopifyOrders: ShopifyOrderPayload[] = [
      {
        id: 1001,
        name: '#1001',
        total_price: '164.50',
        subtotal_price: '140.00',
        total_tax: '14.50',
        shipping_lines: [{ title: 'Standard Ground', price: '10.00' }],
        tax_lines: [{ title: 'California State Sales Tax', price: '14.50', rate: 0.0725 }],
        financial_status: 'paid',
        currency: 'USD',
      },
      {
        id: 1002,
        name: '#1002',
        total_price: '170.75',
        subtotal_price: '160.00',
        total_tax: '8.75',
        shipping_lines: [{ title: 'Priority Courier', price: '2.00' }],
        tax_lines: [{ title: 'New York State Tax', price: '8.75', rate: 0.08875 }],
        financial_status: 'paid',
        currency: 'USD',
      }
    ];

    const normalizedOrders = rawShopifyOrders.map(order => 
      normalizeShopifyOrder(order, 350) // $3.50 fee each = $7.00 total order fees
    );

    // Bucket B: Direct Gateway Operations (Dispute chargeback fee)
    const directTransactions: DirectGatewayTransaction[] = [
      {
        id: 'dp_9901',
        type: 'DISPUTE_FEE',
        amount: 1500, // $15.00 dispute fee
        netAmount: -1500,
        description: 'Stripe dispute inquiry fee on charge ch_3Mxx',
      }
    ];

    // Total Gross Product: (164.50 - 10.00 - 14.50) + (170.75 - 2.00 - 8.75) = $140.00 + $160.00 = $300.00
    // Total Shipping: $10.00 + $2.00 = $12.00
    // Total Taxes: $14.50 (CA) + $8.75 (NY) = $23.25
    // Processing Fees: $3.50 + $3.50 = $7.00
    // Dispute Fee: $15.00
    // Net Bank Deposit = ($300.00 + $12.00 + $23.25) - ($7.00 + $15.00) = $335.25 - $22.00 = $313.25
    const netDepositCents = 31325; // $313.25

    const stripeEvent: StripeWebhookEvent = {
      id: 'evt_stripe_payout_9021',
      type: 'payout.paid',
      created: Math.floor(Date.now() / 1000),
      data: {
        object: {
          id: 'po_multi_state_settlement_001',
          amount: netDepositCents,
          currency: 'usd',
          arrival_date: Math.floor(Date.now() / 1000),
          status: 'paid',
          description: 'STRIPE PAYOUT BATCH - MULTI-STATE DTC',
        }
      }
    };

    const settlement = ingestStripePayoutEvent(stripeEvent, normalizedOrders, directTransactions);

    // Validate with Deterministic Math Gate
    const mathResult = validateMathGate(settlement.deconstructedPayout);

    assert.equal(mathResult.isBalanced, true, 'Math Gate must balance debits and credits to $0.00');
    assert.equal(mathResult.delta, 0.00, 'Delta must be exactly $0.00');
    assert.equal(mathResult.isNetDepositConsistent, true, 'Net cash waterfall must equal net deposit');
    assert.equal(mathResult.calculatedNet, 313.25, 'Calculated net must match exact cents ($313.25)');
    assert.equal(mathResult.violations.length, 0, 'No compliance violations should exist');

    // Verify individual journal legs
    const lines = settlement.deconstructedPayout.lines;
    const stripeClearing = lines.find(l => l.accountCode === COA.CLEARING_STRIPE.code);
    const grossSales = lines.find(l => l.accountCode === COA.GROSS_SALES_ECOM.code);
    const shipping = lines.find(l => l.accountCode === COA.SHIPPING_INCOME.code);
    const disputeFee = lines.find(l => l.accountCode === COA.DISPUTE_CHARGEBACK_FEES.code);
    const caTax = lines.find(l => l.taxJurisdiction === 'CA-CDTFA');
    const nyTax = lines.find(l => l.taxJurisdiction === 'NY-DTF');

    assert.ok(stripeClearing && stripeClearing.debit === 313.25, 'Stripe clearing debit must match net deposit');
    assert.ok(grossSales && grossSales.credit === 300.00, 'Gross sales credit must be $300.00');
    assert.ok(shipping && shipping.credit === 12.00, 'Shipping credit must be $12.00');
    assert.ok(disputeFee && disputeFee.debit === 15.00, 'Dispute fee debit must be $15.00');
    assert.ok(caTax && caTax.credit === 14.50, 'CA tax credit must be $14.50');
    assert.ok(nyTax && nyTax.credit === 8.75, 'NY tax credit must be $8.75');
  });

  // --------------------------------------------------------------------------
  // TEST 3: Idempotency Deduplication Guard
  // --------------------------------------------------------------------------
  await t.test('Test 3: Idempotency Lock Guard drops duplicate webhook deliveries', async () => {
    const payoutId = 'po_dedup_test_8877';

    // First attempt: Must acquire lock
    const firstLock = await persistence.acquireIdempotencyLock(payoutId, 'STRIPE');
    assert.equal(firstLock, true, 'First webhook attempt must acquire lock');

    // Immediate second attempt while PROCESSING: Must be blocked
    const duplicateLock = await persistence.acquireIdempotencyLock(payoutId, 'STRIPE');
    assert.equal(duplicateLock, false, 'Duplicate concurrent webhook must be rejected');

    // Complete lock
    await persistence.completeIdempotencyLock(payoutId);

    // Third attempt after COMPLETED: Must also be blocked
    const completedLock = await persistence.acquireIdempotencyLock(payoutId, 'STRIPE');
    assert.equal(completedLock, false, 'Subsequent replay webhook must be dropped');
  });

  // --------------------------------------------------------------------------
  // TEST 4: Supabase 5-Table Persistence Guarantee
  // --------------------------------------------------------------------------
  await t.test('Test 4: Supabase 5-Table Schema Persistence Guarantee', async () => {
    const batchId = 'po_persist_guarantee_4455';

    const testPayout = {
      batchId,
      processor: 'STRIPE' as const,
      payoutDate: '2026-09-16',
      currency: 'USD',
      grossSales: 500.00,
      taxCollected: 45.00,
      processingFees: 15.00,
      refunds: 0.00,
      reserveWithheld: 0.00,
      netDeposit: 530.00,
      lines: [
        { accountCode: '11500', accountName: 'Stripe Clearing', description: 'Net deposit', debit: 530.00, credit: 0.00 },
        { accountCode: '52000', accountName: 'Processing Fees', description: 'Fees', debit: 15.00, credit: 0.00 },
        { accountCode: '40100', accountName: 'Gross Sales', description: 'Sales', debit: 0.00, credit: 500.00 },
        { accountCode: '22000', accountName: 'Sales Tax Payable', description: 'CA Tax', debit: 0.00, credit: 45.00, taxJurisdiction: 'CA-CDTFA' }
      ],
      confidenceScore: 1.0,
    };

    // Acquire lock and persist
    await persistence.acquireIdempotencyLock(batchId, 'STRIPE');
    const result = await persistence.persistReconciliationBatch({
      payout: testPayout,
      rawPayload: { simulated: true, batchId },
      status: 'MATH_VERIFIED',
      attemptsTaken: 1,
      auditDetails: { testRun: true },
      erpJournalId: 'XERO-JRN-9090',
    });

    assert.equal(result.isDuplicate, false);
    assert.equal(result.linesCount, 4);
    assert.ok(result.tablesUpdated.includes('payout_batches'));
    assert.ok(result.tablesUpdated.includes('ground_truth_records'));
    assert.ok(result.tablesUpdated.includes('ledger_journal_records'));
    assert.ok(result.tablesUpdated.includes('audit_logs'));
    assert.ok(result.tablesUpdated.includes('idempotency_locks'));

    // Check Snapshot
    const snapshot = persistence.getSnapshot(batchId);
    assert.equal(snapshot.batch.batchId, batchId);
    assert.equal(snapshot.batch.grossSales, '500.00');
    assert.equal(snapshot.batch.netDeposit, '530.00');
    assert.equal(snapshot.groundTruth.gatewayNetDeposit, '530.00');
    assert.equal(snapshot.journalLines.length, 4);
    assert.equal(snapshot.auditLogs.length, 1);
    assert.equal(snapshot.lock?.status, 'COMPLETED');
  });
});
