import { generateObject, LanguageModel } from 'ai';
import { google } from '@ai-sdk/google';
import { DeconstructedPayout, DeconstructedPayoutSchema, COA } from '@settlement-agent/shared';

export interface ParsePayoutOptions {
  model?: LanguageModel;
  repairFeedbackPrompt?: string;
  processor?: 'STRIPE' | 'SHOPIFY_PAYMENTS' | 'PAYPAL' | 'MINDBODY' | 'AMAZON_PAY';
}

const SYSTEM_PROMPT = `
You are the Settlement Agent Deconstruction Engine, an autonomous forensic accounting system specializing in Client Advisory Services (CAS).

YOUR MISSION:
Deconstruct lumped payment processor deposits (e.g., Stripe Payouts, Shopify Payments) into penny-exact US GAAP double-entry general ledger journal entries.

STANDARD CHART OF ACCOUNTS (COA) CONTEXT:
- 10100: Operating Checking Account (Asset, Normal: DEBIT)
- 11500: Stripe Payout Clearing Account (Asset, Normal: DEBIT)
- 11510: Shopify Payments Clearing (Asset, Normal: DEBIT)
- 11600: Merchant Gateway Reserve Receivable (Asset, Normal: DEBIT)
- 22000: Sales Tax Agency Payable (Liability, Normal: CREDIT)
- 40100: Gross E-Commerce Sales (Revenue, Normal: CREDIT)
- 41000: Shipping & Delivery Income (Revenue, Normal: CREDIT)
- 49000: Sales Returns & Customer Refunds (Contra-Revenue, Normal: DEBIT)
- 52000: Merchant Payment Processing Fees (COGS/Expense, Normal: DEBIT)
- 52100: Gateway Dispute & Chargeback Fees (COGS/Expense, Normal: DEBIT)

DOUBLE-ENTRY MECHANICS (UNCOMPROMISING LAWS):
1. Cash deposited to Clearing (11500 or 11510) is a DEBIT equal to netDeposit.
2. Merchant Processing Fees (52000) are a DEBIT.
3. Customer Refunds (49000) are a DEBIT.
4. Gross E-Commerce Sales (40100) are a CREDIT.
5. Sales Tax Collected (22000) is a CREDIT.
6. EQUILIBRIUM: Sum of Debits MUST EQUAL Sum of Credits to the exact penny ($0.00 difference).
7. NET WATERFALL: Net Deposit = Gross Sales + Tax Collected - Refunds - Processing Fees - Reserve Withheld.

Extract all metrics and generate the journal line items strictly adhering to the schema.
`.trim();

/**
 * Extracts and deconstructs a raw payment processor payout into structured
 * double-entry journal lines adhering to US GAAP and the Deterministic Math Gate.
 */
export async function parsePayoutPayload(
  rawPayload: string | Record<string, any>,
  options: ParsePayoutOptions = {}
): Promise<DeconstructedPayout> {
  const model = options.model ?? google('gemini-2.5-flash');

  const payloadString = typeof rawPayload === 'string' 
    ? rawPayload 
    : JSON.stringify(rawPayload, null, 2);

  let userPrompt = `Analyze and deconstruct the following payment processor settlement payload:\n\n${payloadString}`;

  // If this is a retry attempt following a Math Gate failure, inject the feedback prompt
  if (options.repairFeedbackPrompt) {
    userPrompt += `\n\n=======================================================\n` +
      `CRITICAL FEEDBACK FROM DETERMINISTIC MATH GATE AUDIT:\n` +
      `${options.repairFeedbackPrompt}\n` +
      `=======================================================\n` +
      `You MUST correct the imbalance identified above. Adjust rounding pennies on the fee or tax line to balance the ledger down to $0.00.`;
  }

  const { object } = await generateObject({
    model,
    schema: DeconstructedPayoutSchema,
    system: SYSTEM_PROMPT,
    prompt: userPrompt,
    temperature: 0.1, // Near-zero temperature for maximum mathematical and schema determinism
  });

  return object;
}
