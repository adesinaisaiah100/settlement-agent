import { XeroConnector } from '../src/lib/connectors/xeroConnector';
import { QBOConnector } from '../src/lib/connectors/qboConnector';
import { JournalLineItem } from '@settlement-agent/shared';

const mockLines: JournalLineItem[] = [
  {
    accountCode: '11500',
    accountName: 'Stripe Payout Clearing Account',
    description: 'Net bank deposit received into clearing account',
    debit: 10490.00,
    credit: 0.00,
  },
  {
    accountCode: '52000',
    accountName: 'Merchant Payment Processing Fees',
    description: 'Stripe transaction and processing fees',
    debit: 310.00,
    credit: 0.00,
  },
  {
    accountCode: '40100',
    accountName: 'Gross E-Commerce Sales',
    description: 'Total product gross sales',
    debit: 0.00,
    credit: 10000.00,
  },
  {
    accountCode: '22000',
    accountName: 'Sales Tax Agency Payable',
    description: 'California sales tax collected (CDTFA)',
    debit: 0.00,
    credit: 800.00,
    taxJurisdiction: 'CA-CDTFA',
  },
];

export function runConnectorsTest() {
  console.log('🧪 Starting Phase 3: Ledger Connectors & Safety Fallback Test Suite...\n');
  let passed = 0;
  const total = 4;

  const mockXero = new XeroConnector({
    clientId: 'mock_client_id',
    clientSecret: 'mock_client_secret',
    accessToken: 'mock_access_token',
    refreshToken: 'mock_refresh_token',
    tenantId: 'mock_tenant_guid_90214',
  });

  const mockQBO = new QBOConnector({
    clientId: 'mock_qbo_id',
    clientSecret: 'mock_qbo_secret',
    accessToken: 'mock_qbo_access_token',
    refreshToken: 'mock_qbo_refresh_token',
    realmId: 'mock_realm_12345',
  });

  // TEST 1: Xero Accounting Sign Conventions (+ Debits, - Credits)
  const xeroPayload = mockXero.formatManualJournalPayload({
    batchId: 'po_1QvBatch8921',
    payoutDate: '2026-09-16T10:00:00Z',
    lines: mockLines,
    status: 'POSTED',
  });

  const xeroDebit1 = xeroPayload.JournalLines[0].LineAmount; // Should be +10490
  const xeroCredit1 = xeroPayload.JournalLines[2].LineAmount; // Should be -10000

  if (xeroDebit1 === 10490.00 && xeroCredit1 === -10000.00 && xeroPayload.Status === 'POSTED') {
    console.log('✅ TEST 1 PASSED: Xero signed amounts verified (+ for Debits, - for Credits)');
    passed++;
  } else {
    console.error('❌ TEST 1 FAILED:', xeroPayload);
  }

  // TEST 2: QBO Schema Formatting (Positive amounts with explicit PostingType)
  const qboPayload = mockQBO.formatJournalEntryPayload({
    batchId: 'po_1QvBatch8921',
    payoutDate: '2026-09-16T10:00:00Z',
    lines: mockLines,
  });

  const qboLine1 = qboPayload.Line[0];
  const qboLine3 = qboPayload.Line[2];

  const qboValid = 
    qboLine1.Amount === 10490.00 && 
    qboLine1.JournalEntryLineDetail.PostingType === 'Debit' &&
    qboLine3.Amount === 10000.00 &&
    qboLine3.JournalEntryLineDetail.PostingType === 'Credit';

  if (qboValid) {
    console.log('✅ TEST 2 PASSED: QBO positive decimal amounts and PostingType (Debit/Credit) verified');
    passed++;
  } else {
    console.error('❌ TEST 2 FAILED:', qboPayload);
  }

  // TEST 3: Xero "DRAFT with Reason" Safety Fallback on Rejection
  const escalationReason = 'Imbalance of $0.02 detected after 3 feedback retries';
  const xeroDraftPayload = mockXero.formatManualJournalPayload({
    batchId: 'po_EscalatedBatch',
    payoutDate: '2026-09-16T10:00:00Z',
    lines: mockLines,
    status: 'DRAFT',
    reason: escalationReason,
  });

  if (
    xeroDraftPayload.Status === 'DRAFT' && 
    xeroDraftPayload.Narration.includes('AUDIT ESCALATION') &&
    xeroDraftPayload.Narration.includes('$0.02')
  ) {
    console.log('✅ TEST 3 PASSED: Xero DRAFT fallback with machine audit reason verified');
    passed++;
  } else {
    console.error('❌ TEST 3 FAILED:', xeroDraftPayload);
  }

  // TEST 4: Date normalization across timezones
  if (xeroPayload.Date === '2026-09-16' && qboPayload.TxnDate === '2026-09-16') {
    console.log('✅ TEST 4 PASSED: ISO-8601 timestamps normalized to strict YYYY-MM-DD financial format');
    passed++;
  } else {
    console.error('❌ TEST 4 FAILED: Date mismatch', { xero: xeroPayload.Date, qbo: qboPayload.TxnDate });
  }

  console.log(`\n🏁 Test Results: ${passed}/${total} Passed.`);
  if (passed !== total) {
    process.exit(1);
  }
}

runConnectorsTest();
