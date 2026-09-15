import { z } from 'zod';
import { COA } from './coa';

export const JournalLineItemSchema = z.object({
  accountCode: z.string().describe('The 5-digit general ledger account code (e.g. 11500, 22000, 52000)'),
  accountName: z.string().describe('Human-readable general ledger account title'),
  description: z.string().describe('Audit explanation of this specific leg of the transaction'),
  debit: z.number().nonnegative().describe('Debit amount in USD cents or decimal (e.g. 10490.00)'),
  credit: z.number().nonnegative().describe('Credit amount in USD cents or decimal (e.g. 0.00)'),
  taxJurisdiction: z.string().optional().describe('State or municipal tax authority if applicable (e.g. CA-CDTFA)'),
});

export type JournalLineItem = z.infer<typeof JournalLineItemSchema>;

export const DeconstructedPayoutSchema = z.object({
  batchId: z.string().describe('Processor settlement batch identifier (e.g. STR-89241 or SHP-90214)'),
  processor: z.enum(['STRIPE', 'SHOPIFY_PAYMENTS', 'PAYPAL', 'MINDBODY', 'AMAZON_PAY']).describe('Gateway source'),
  payoutDate: z.string().describe('ISO 8601 settlement execution date'),
  currency: z.string().default('USD'),
  grossSales: z.number().positive().describe('Total gross product/service sales before any deductions'),
  taxCollected: z.number().nonnegative().describe('Total sales tax collected from customers'),
  processingFees: z.number().nonnegative().describe('Gateway transaction processing and interchange fees deducted'),
  refunds: z.number().nonnegative().describe('Customer refunds, chargebacks, and returns reversed from batch'),
  reserveWithheld: z.number().nonnegative().default(0).describe('Rolling risk reserve held back by the processor'),
  netDeposit: z.number().positive().describe('The actual cash amount deposited into the bank account feed'),
  lines: z.array(JournalLineItemSchema).min(2).describe('Complete double-entry journal lines that balance to the penny'),
  confidenceScore: z.number().min(0).max(1).describe('Extraction confidence rating from 0.00 to 1.00'),
});

export type DeconstructedPayout = z.infer<typeof DeconstructedPayoutSchema>;

export interface MathGateValidationResult {
  isBalanced: boolean;
  totalDebits: number;
  totalCredits: number;
  delta: number;
  isNetDepositConsistent: boolean;
  calculatedNet: number;
  statedNet: number;
  validationTimestamp: string;
  violations: string[];
}

export type BatchStatus = 
  | 'INGESTED'
  | 'DECONSTRUCTING'
  | 'MATH_VERIFIED'
  | 'REPAIR_RETRYING'
  | 'ESCALATED_HUMAN_REVIEW'
  | 'STAGED_XERO_DRAFT'
  | 'RECONCILED';
