import { validateMathGate } from '../src/gates/mathGate';
import { DeconstructedPayout } from '@settlement-agent/shared';

// Test 1: Perfectly Balanced Stripe Payout
export const sampleBalancedPayout: DeconstructedPayout = {
  batchId: 'po_1QvExample90214',
  processor: 'STRIPE',
  payoutDate: '2026-09-15T10:00:00Z',
  currency: 'USD',
  grossSales: 10000.00,
  taxCollected: 800.00,
  processingFees: 310.00,
  refunds: 0.00,
  reserveWithheld: 0.00,
  netDeposit: 10490.00,
  lines: [
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
      description: 'Stripe transaction and processing fees (2.9% + $0.30)',
      debit: 310.00,
      credit: 0.00,
    },
    {
      accountCode: '40100',
      accountName: 'Gross E-Commerce Sales',
      description: 'Total product gross sales for settlement batch',
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
  ],
  confidenceScore: 0.99,
};

// Test 2: Imbalanced Payout (0.02 cent rounding hallucination)
export const sampleImbalancedPayout: DeconstructedPayout = {
  ...sampleBalancedPayout,
  batchId: 'po_Imbalanced002',
  lines: [
    {
      ...sampleBalancedPayout.lines[0],
      debit: 10490.02, // 2 cents excess debit
    },
    sampleBalancedPayout.lines[1],
    sampleBalancedPayout.lines[2],
    sampleBalancedPayout.lines[3],
  ],
};

// Test 3: Waterfall Discrepancy (Fees don't match net deposit)
export const sampleWaterfallMismatchPayout: DeconstructedPayout = {
  ...sampleBalancedPayout,
  batchId: 'po_WaterfallMismatch',
  processingFees: 350.00, // Stated fee differs from calculated net
};

// Test 4: Invalid Account Code (Hallucinated 99999)
export const sampleInvalidAccountPayout: DeconstructedPayout = {
  ...sampleBalancedPayout,
  batchId: 'po_InvalidAccount',
  lines: [
    sampleBalancedPayout.lines[0],
    {
      ...sampleBalancedPayout.lines[1],
      accountCode: '99999',
      accountName: 'Hallucinated Fee Account',
    },
    sampleBalancedPayout.lines[2],
    sampleBalancedPayout.lines[3],
  ],
};

/**
 * Deterministic Test Runner for Math Gate
 */
export function runMathGateTests() {
  console.log('🧪 Starting Settlement Agent Deterministic Math Gate Test Suite...\n');
  let passedTests = 0;
  let totalTests = 4;

  // Test 1: Balanced Entry
  const res1 = validateMathGate(sampleBalancedPayout);
  if (res1.isBalanced && res1.isNetDepositConsistent && res1.violations.length === 0 && !res1.repairPrompt) {
    console.log('✅ TEST 1 PASSED: Perfectly balanced payout verified (Delta: $0.00, Waterfall: Consistent)');
    passedTests++;
  } else {
    console.error('❌ TEST 1 FAILED:', res1);
  }

  // Test 2: Imbalanced Entry
  const res2 = validateMathGate(sampleImbalancedPayout);
  if (!res2.isBalanced && res2.delta === 0.02 && res2.repairPrompt && res2.repairPrompt.includes('Double-Entry Imbalance: $0.02')) {
    console.log('✅ TEST 2 PASSED: Imbalanced entry correctly blocked with generated self-repair prompt');
    passedTests++;
  } else {
    console.error('❌ TEST 2 FAILED:', res2);
  }

  // Test 3: Waterfall Mismatch
  const res3 = validateMathGate(sampleWaterfallMismatchPayout);
  if (!res3.isNetDepositConsistent && res3.repairPrompt && res3.repairPrompt.includes('waterfall discrepancy')) {
    console.log('✅ TEST 3 PASSED: Waterfall variance ($40.00) correctly detected and flagged');
    passedTests++;
  } else {
    console.error('❌ TEST 3 FAILED:', res3);
  }

  // Test 4: Invalid Account Code
  const res4 = validateMathGate(sampleInvalidAccountPayout);
  if (res4.violations.some(v => v.includes('Account code 99999') && v.includes('does not exist in standard Chart of Accounts'))) {
    console.log('✅ TEST 4 PASSED: Hallucinated account code (99999) rejected by US GAAP COA guard');
    passedTests++;
  } else {
    console.error('❌ TEST 4 FAILED:', res4);
  }

  console.log(`\n🏁 Test Results: ${passedTests}/${totalTests} Passed.`);
  return passedTests === totalTests;
}

// Execute tests if invoked directly
runMathGateTests();

