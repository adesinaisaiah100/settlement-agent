import { DeconstructedPayout, MathGateValidationResult, COA } from '@settlement-agent/shared';

/**
 * Converts a dollar decimal amount to integer cents to guarantee
 * immunity from IEEE 754 floating-point arithmetic imprecision.
 */
function toCents(amount: number): number {
  return Math.round(amount * 100);
}

/**
 * Formats integer cents as a currency string (e.g. 10490 -> "$104.90").
 */
function formatCents(cents: number): string {
  return `$${(cents / 100).toFixed(2)}`;
}

/**
 * Deterministic Math Gate
 * 
 * Verifies two uncompromising mathematical laws before any journal entry
 * is permitted to touch an ERP / General Ledger (QuickBooks Online / Xero):
 * 
 * 1. Double-Entry Equilibrium Law: Sum of Debits - Sum of Credits === 0.00
 * 2. Net Cash Waterfall Law: Stated Net === Gross + Tax - Refunds - Fees - Reserve
 * 
 * If either law is violated, it produces a structured feedback prompt with
 * exact cent deltas for the AI self-repair feedback loop.
 */
export function validateMathGate(payout: DeconstructedPayout): MathGateValidationResult {
  const violations: string[] = [];

  // 1. Calculate Sum of Debits and Credits in integer cents
  const totalDebitsCents = payout.lines.reduce((acc, line) => acc + toCents(line.debit), 0);
  const totalCreditsCents = payout.lines.reduce((acc, line) => acc + toCents(line.credit), 0);
  const deltaCents = Math.abs(totalDebitsCents - totalCreditsCents);
  const isBalanced = deltaCents === 0;

  if (!isBalanced) {
    const direction = totalDebitsCents > totalCreditsCents ? 'Debits exceed Credits' : 'Credits exceed Debits';
    violations.push(
      `Double-entry imbalance of ${formatCents(deltaCents)} (${direction}). ` +
      `Debits: ${formatCents(totalDebitsCents)}, Credits: ${formatCents(totalCreditsCents)}.`
    );
  }

  // 2. Validate Net Cash Waterfall against processor totals
  const grossSalesCents = toCents(payout.grossSales);
  const taxCollectedCents = toCents(payout.taxCollected);
  const refundsCents = toCents(payout.refunds);
  const feesCents = toCents(payout.processingFees);
  const reserveCents = toCents(payout.reserveWithheld);
  const statedNetCents = toCents(payout.netDeposit);

  // Stated Net = Gross Sales + Sales Tax Collected - Refunds - Processing Fees - Reserve Withheld
  const calculatedNetCents = grossSalesCents + taxCollectedCents - refundsCents - feesCents - reserveCents;
  const waterfallDeltaCents = Math.abs(calculatedNetCents - statedNetCents);
  const isNetDepositConsistent = waterfallDeltaCents === 0;

  if (!isNetDepositConsistent) {
    violations.push(
      `Net cash waterfall discrepancy of ${formatCents(waterfallDeltaCents)}. ` +
      `Processor stated net deposit is ${formatCents(statedNetCents)}, ` +
      `but calculated net (Gross + Tax - Refunds - Fees - Reserve) is ${formatCents(calculatedNetCents)}.`
    );
  }

  // 3. Validate Account Codes against US GAAP Chart of Accounts
  const validCodes = new Set(Object.values(COA).map((acc) => acc.code));
  for (const line of payout.lines) {
    if (!validCodes.has(line.accountCode as any)) {
      violations.push(
        `Account code ${line.accountCode} (${line.accountName}) does not exist in standard Chart of Accounts.`
      );
    }

    // Ensure line does not have both debit and credit populated
    if (line.debit > 0 && line.credit > 0) {
      violations.push(
        `Invalid line item for account ${line.accountCode}: Cannot have both debit (${line.debit}) and credit (${line.credit}) on the same line.`
      );
    }
  }

  // 4. Validate that Net Cash Clearing Account has matching debit
  const clearingLines = payout.lines.filter(
    (line) => line.accountCode === COA.CLEARING_STRIPE.code ||
              line.accountCode === COA.CLEARING_SHOPIFY.code ||
              line.accountCode === COA.OPERATING_CASH.code
  );

  const totalClearingDebitCents = clearingLines.reduce((acc, line) => acc + toCents(line.debit), 0);
  if (totalClearingDebitCents !== statedNetCents) {
    violations.push(
      `Clearing account debit ${formatCents(totalClearingDebitCents)} does not match stated net deposit ${formatCents(statedNetCents)}.`
    );
  }

  const isValid = isBalanced && isNetDepositConsistent && violations.length === 0;

  // 5. Generate structured self-repair prompt if verification fails
  let repairPrompt: string | undefined = undefined;
  if (!isValid) {
    repairPrompt = generateSelfRepairPrompt({
      batchId: payout.batchId,
      processor: payout.processor,
      totalDebitsCents,
      totalCreditsCents,
      deltaCents,
      statedNetCents,
      calculatedNetCents,
      waterfallDeltaCents,
      violations,
    });
  }

  return {
    isBalanced,
    totalDebits: totalDebitsCents / 100,
    totalCredits: totalCreditsCents / 100,
    delta: deltaCents / 100,
    isNetDepositConsistent,
    calculatedNet: calculatedNetCents / 100,
    statedNet: statedNetCents / 100,
    validationTimestamp: new Date().toISOString(),
    violations,
    repairPrompt,
  };
}

interface RepairPromptParams {
  batchId: string;
  processor: string;
  totalDebitsCents: number;
  totalCreditsCents: number;
  deltaCents: number;
  statedNetCents: number;
  calculatedNetCents: number;
  waterfallDeltaCents: number;
  violations: string[];
}

/**
 * Builds an uncompromising mathematical correction prompt for the LLM retry loop.
 */
function generateSelfRepairPrompt(params: RepairPromptParams): string {
  return `
[RECONCILIATION MATH AUDIT REJECTION - BATCH ${params.batchId}]
Your proposed settlement deconstruction failed the deterministic math gate.

MATHEMATICAL LEDGER AUDIT:
- Sum of Debits: ${formatCents(params.totalDebitsCents)}
- Sum of Credits: ${formatCents(params.totalCreditsCents)}
- Double-Entry Imbalance: ${formatCents(params.deltaCents)} (${params.totalDebitsCents > params.totalCreditsCents ? 'Debits exceed Credits' : 'Credits exceed Debits'})
- Processor Stated Net Deposit: ${formatCents(params.statedNetCents)}
- Calculated Net Cash: ${formatCents(params.calculatedNetCents)}
- Waterfall Variance: ${formatCents(params.waterfallDeltaCents)}

SPECIFIC AUDIT VIOLATIONS DETECTED:
${params.violations.map((v, i) => `  ${i + 1}. ${v}`).join('\n')}

MANDATORY CORRECTION INSTRUCTIONS:
1. Recalculate and adjust line items so that Sum of Debits EXACTLY equals Sum of Credits down to 0.00 cents.
2. The Cash Clearing account (11500 for Stripe, 11510 for Shopify) Debit MUST EQUAL EXACTLY ${formatCents(params.statedNetCents)}.
3. Do not modify the processor's stated gross sales, processing fees, or net deposit; resolve any fractional rounding pennies in the Sales Tax or Merchant Processing Fee lines.
4. Output only valid 5-digit account codes from the US GAAP Chart of Accounts.
`.trim();
}
