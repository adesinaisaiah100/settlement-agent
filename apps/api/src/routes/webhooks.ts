import { Hono } from 'hono';
import { 
  verifyStripeSignature, 
  ingestStripePayoutEvent, 
  StripeWebhookEvent 
} from '../lib/gateways/stripeWebhookHandler';
import { normalizeShopifyOrder, ShopifyOrderPayload } from '../lib/gateways/shopifyNormalizer';
import { validateMathGate } from '../gates/mathGate';
import { SettlementPersistenceService } from '../db/persistence';
import { XeroConnector, XeroAuthCredentials } from '../lib/connectors/xeroConnector';
import { QBOConnector, QBOAuthCredentials } from '../lib/connectors/qboConnector';

const webhooks = new Hono();
const persistence = new SettlementPersistenceService();

/**
 * POST /api/webhooks/stripe
 * Stripe payout.paid webhook listener
 */
webhooks.post('/stripe', async (c) => {
  try {
    const rawBody = await c.req.text();
    const signatureHeader = c.req.header('stripe-signature') || '';
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || 'whsec_test_secret';

    // Signature verification (unless in explicit mock mode)
    const isMock = c.req.header('x-mock-mode') === 'true';
    if (!isMock && process.env.NODE_ENV === 'production') {
      const isValid = verifyStripeSignature(rawBody, signatureHeader, webhookSecret);
      if (!isValid) {
        return c.json({ error: 'Invalid Stripe signature' }, 401);
      }
    }

    const event: StripeWebhookEvent = JSON.parse(rawBody);

    if (event.type !== 'payout.paid') {
      return c.json({ message: `Ignored event type: ${event.type}` }, 200);
    }

    const payoutId = event.data.object.id;

    // 1. Idempotency Lock Check
    const acquiredLock = await persistence.acquireIdempotencyLock(payoutId, 'STRIPE');
    if (!acquiredLock) {
      return c.json({
        status: 'IGNORED_DUPLICATE',
        message: `Payout ${payoutId} already processed or currently locking`,
      }, 200);
    }

    // 2. Ingest and Deconstruct through Two-Bucket Classifier
    const settlement = ingestStripePayoutEvent(event);

    // 3. Deterministic Math Gate Verification
    const mathResult = validateMathGate(settlement.deconstructedPayout);

    // 4. Staging Status
    const isVerified = mathResult.isBalanced && mathResult.isNetDepositConsistent;
    const finalStatus = isVerified ? 'MATH_VERIFIED' : 'STAGED_XERO_DRAFT';

    // 5. Supabase Table Persistence
    const persistResult = await persistence.persistReconciliationBatch({
      payout: settlement.deconstructedPayout,
      rawPayload: event,
      status: finalStatus,
      attemptsTaken: 1,
      auditDetails: {
        mathGateResult: mathResult,
        eventCreated: event.created,
      },
    });

    return c.json({
      success: true,
      payoutId,
      status: finalStatus,
      isMathVerified: isVerified,
      mathSummary: {
        totalDebits: mathResult.totalDebits,
        totalCredits: mathResult.totalCredits,
        delta: mathResult.delta,
      },
      persistence: persistResult,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Stripe webhook ingestion failed' }, 500);
  }
});

/**
 * POST /api/webhooks/simulate-settlement
 * Full-cycle simulated settlement endpoint for developer test drills and automated audits
 */
webhooks.post('/simulate-settlement', async (c) => {
  try {
    const body = await c.req.json();
    const { 
      event, 
      shopifyOrders = [], 
      directTransactions = [], 
      targetLedger = 'NONE',
      xeroCredentials,
      qboCredentials,
      firmReviewPolicy = 'ALWAYS_DRAFT'
    } = body;

    if (!event || !event.data || !event.data.object) {
      return c.json({ error: 'Missing valid Stripe payout.paid event in body' }, 400);
    }

    const payoutId = event.data.object.id;

    // 1. Acquire Idempotency Lock
    const acquiredLock = await persistence.acquireIdempotencyLock(payoutId, 'STRIPE');
    if (!acquiredLock) {
      return c.json({
        status: 'IGNORED_DUPLICATE',
        message: `Payout ${payoutId} already processed or currently locking`,
      }, 409);
    }

    // 2. Normalize Bucket A: Shopify Orders
    const normalizedOrders = (shopifyOrders as ShopifyOrderPayload[]).map(order => 
      normalizeShopifyOrder(order, 350) // $3.50 simulated gateway fee
    );

    // 3. Two-Bucket Deconstruction
    const settlement = ingestStripePayoutEvent(event, normalizedOrders, directTransactions);

    // 4. Deterministic Math Gate Verification
    const mathResult = validateMathGate(settlement.deconstructedPayout);
    const isVerified = mathResult.isBalanced && mathResult.isNetDepositConsistent;

    // 5. Optional Ledger Staging
    let erpJournalId: string | undefined;
    let ledgerStatus: 'POSTED' | 'DRAFT' | 'SKIPPED' = 'SKIPPED';

    if (targetLedger === 'XERO' && xeroCredentials) {
      const xero = new XeroConnector(xeroCredentials as XeroAuthCredentials);
      const shouldPost = isVerified && firmReviewPolicy === 'AUTO_POST';
      const xeroRes = await xero.postManualJournal({
        batchId: payoutId,
        payoutDate: settlement.payoutDate,
        lines: settlement.deconstructedPayout.lines,
        status: shouldPost ? 'POSTED' : 'DRAFT',
        reason: isVerified ? undefined : `Math Gate Imbalance: ${mathResult.violations[0]}`,
      });
      erpJournalId = xeroRes.manualJournalId;
      ledgerStatus = shouldPost ? 'POSTED' : 'DRAFT';
    }

    const finalBatchStatus = isVerified 
      ? (targetLedger === 'XERO' && ledgerStatus === 'DRAFT' ? 'STAGED_XERO_DRAFT' : 'MATH_VERIFIED') 
      : 'ESCALATED_HUMAN_REVIEW';

    // 6. Supabase Persistence
    const persistResult = await persistence.persistReconciliationBatch({
      payout: settlement.deconstructedPayout,
      rawPayload: body,
      status: finalBatchStatus,
      attemptsTaken: 1,
      auditDetails: {
        mathGateResult: mathResult,
        orderCount: normalizedOrders.length,
        directCount: directTransactions.length,
      },
      erpJournalId,
    });

    return c.json({
      success: true,
      payoutId,
      status: finalBatchStatus,
      isMathVerified: isVerified,
      mathSummary: mathResult,
      deconstructedLines: settlement.deconstructedPayout.lines,
      ledgerStaging: {
        targetLedger,
        status: ledgerStatus,
        erpJournalId,
      },
      persistence: persistResult,
      dbSnapshot: persistence.getSnapshot(payoutId),
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Simulated settlement execution failed' }, 500);
  }
});

export default webhooks;
