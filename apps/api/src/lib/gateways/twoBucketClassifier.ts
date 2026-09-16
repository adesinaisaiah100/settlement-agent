import { COA } from '@settlement-agent/shared';
import { JournalLineItem } from '@settlement-agent/shared';

/**
 * Bucket A: Order-Linked Transaction (from e-commerce store like Shopify)
 */
export interface OrderLinkedTransaction {
  id: string;
  sourceOrderId: string; // e.g. "SHP-10928"
  grossAmount: number;   // In cents (e.g. 12850 = $128.50)
  feeAmount: number;     // Gateway fee in cents (e.g. 393 = $3.93)
  netAmount: number;     // In cents
  shippingAmount: number;// In cents (e.g. 1000 = $10.00)
  taxes: Array<{
    jurisdiction: string; // e.g. "CA-CDTFA" or "NY-DTF"
    rate: number;         // e.g. 0.0725
    amount: number;       // In cents (e.g. 850 = $8.50)
  }>;
}

/**
 * Bucket B: Direct Gateway Transaction (Direct processor events without cart order)
 */
export interface DirectGatewayTransaction {
  id: string;
  type: 'DISPUTE_FEE' | 'CHARGEBACK_CLAWBACK' | 'RADAR_FEE' | 'RESERVE_WITHHELD' | 'REFUND' | 'ADJUSTMENT';
  amount: number;        // In cents
  feeAmount?: number;    // In cents
  netAmount: number;     // In cents
  description: string;
  chargeId?: string;
}

export interface TwoBucketClassificationResult {
  bucketAOrders: OrderLinkedTransaction[];
  bucketBDirect: DirectGatewayTransaction[];
  totalGrossCents: number;
  totalTaxCents: number;
  totalShippingCents: number;
  totalFeesCents: number;
  totalRefundsCents: number;
  totalReserveCents: number;
  totalNetCents: number;
  synthesizedLines: JournalLineItem[];
}

/**
 * The Two-Bucket Transaction Classifier
 * Segregates raw Stripe balance transactions into:
 * - Bucket A (Order-Linked): Extracts sales, shipping income, and multi-state tax payables
 * - Bucket B (Direct Stripe): Captures disputes, radar risk fees, reserve withholdings, refunds
 */
export function classifyTwoBucketTransactions(
  orderLinked: OrderLinkedTransaction[],
  directGateway: DirectGatewayTransaction[],
  payoutNetCents: number
): TwoBucketClassificationResult {
  let totalGrossCents = 0;
  let totalTaxCents = 0;
  let totalShippingCents = 0;
  let totalFeesCents = 0;
  let totalRefundsCents = 0;
  let totalReserveCents = 0;

  // Process Bucket A: Order-Linked
  const taxByJurisdiction: Record<string, number> = {};

  for (const order of orderLinked) {
    const orderTaxCents = order.taxes.reduce((acc, t) => acc + t.amount, 0);
    const orderProductCents = order.grossAmount - order.shippingAmount - orderTaxCents;
    totalGrossCents += orderProductCents;
    totalShippingCents += order.shippingAmount;
    totalFeesCents += order.feeAmount;

    for (const tax of order.taxes) {
      taxByJurisdiction[tax.jurisdiction] = (taxByJurisdiction[tax.jurisdiction] || 0) + tax.amount;
      totalTaxCents += tax.amount;
    }
  }

  // Process Bucket B: Direct Gateway Operations
  let disputeFeesCents = 0;
  for (const direct of directGateway) {
    if (direct.type === 'DISPUTE_FEE') {
      disputeFeesCents += direct.amount;
      totalFeesCents += direct.amount;
    } else if (direct.type === 'CHARGEBACK_CLAWBACK' || direct.type === 'REFUND') {
      totalRefundsCents += Math.abs(direct.amount);
    } else if (direct.type === 'RESERVE_WITHHELD') {
      totalReserveCents += direct.amount;
    } else if (direct.type === 'RADAR_FEE') {
      totalFeesCents += direct.amount;
    }
  }

  // Calculate Net Cash Waterfall:
  // Net = (Gross + Shipping + Tax) - ProcessingFees - Refunds - Reserve
  const calculatedNetCents = 
    (totalGrossCents + totalShippingCents + totalTaxCents) 
    - totalFeesCents 
    - totalRefundsCents 
    - totalReserveCents;

  // Synthesize Balanced US GAAP Journal Lines
  const synthesizedLines: JournalLineItem[] = [];

  // 1. Stripe Clearing Account (Asset) - The Net Bank Deposit (DEBIT)
  synthesizedLines.push({
    accountCode: COA.CLEARING_STRIPE.code,
    accountName: COA.CLEARING_STRIPE.name,
    description: 'Net bank deposit from Stripe settlement batch',
    debit: payoutNetCents / 100,
    credit: 0.00,
  });

  // 2. Merchant Payment Processing Fees (COGS / Expense) (DEBIT)
  const generalProcessingFees = totalFeesCents - disputeFeesCents;
  if (generalProcessingFees > 0) {
    synthesizedLines.push({
      accountCode: COA.MERCHANT_PROCESSING_FEES.code,
      accountName: COA.MERCHANT_PROCESSING_FEES.name,
      description: 'Stripe transaction interchange and processing fees',
      debit: generalProcessingFees / 100,
      credit: 0.00,
    });
  }

  // 3. Dispute & Chargeback Fees (Bucket B Direct) (DEBIT)
  if (disputeFeesCents > 0) {
    synthesizedLines.push({
      accountCode: COA.DISPUTE_CHARGEBACK_FEES.code,
      accountName: COA.DISPUTE_CHARGEBACK_FEES.name,
      description: 'Stripe formal dispute and chargeback processing fees',
      debit: disputeFeesCents / 100,
      credit: 0.00,
    });
  }

  // 4. Sales Returns & Customer Refunds (Contra-Revenue) (DEBIT)
  if (totalRefundsCents > 0) {
    synthesizedLines.push({
      accountCode: COA.RETURNS_AND_ALLOWANCES.code,
      accountName: COA.RETURNS_AND_ALLOWANCES.name,
      description: 'Customer returns and disputed chargeback reversals',
      debit: totalRefundsCents / 100,
      credit: 0.00,
    });
  }

  // 5. Gateway Reserve Receivable (Asset) (DEBIT if withheld)
  if (totalReserveCents > 0) {
    synthesizedLines.push({
      accountCode: COA.GATEWAY_RESERVE_RECEIVABLE.code,
      accountName: COA.GATEWAY_RESERVE_RECEIVABLE.name,
      description: 'Rolling risk reserve withheld by gateway',
      debit: totalReserveCents / 100,
      credit: 0.00,
    });
  }

  // 6. Gross E-Commerce Product Sales (Revenue) (CREDIT)
  if (totalGrossCents > 0) {
    synthesizedLines.push({
      accountCode: COA.GROSS_SALES_ECOM.code,
      accountName: COA.GROSS_SALES_ECOM.name,
      description: 'Gross e-commerce merchandise sales before fees',
      debit: 0.00,
      credit: totalGrossCents / 100,
    });
  }

  // 7. Shipping & Delivery Income (Revenue) (CREDIT)
  if (totalShippingCents > 0) {
    synthesizedLines.push({
      accountCode: COA.SHIPPING_INCOME.code,
      accountName: COA.SHIPPING_INCOME.name,
      description: 'Customer-paid shipping and fulfillment revenue',
      debit: 0.00,
      credit: totalShippingCents / 100,
    });
  }

  // 8. Sales Tax Agency Payable Lines by State Jurisdiction (Liability) (CREDIT)
  for (const [jurisdiction, taxCents] of Object.entries(taxByJurisdiction)) {
    if (taxCents > 0) {
      synthesizedLines.push({
        accountCode: COA.SALES_TAX_PAYABLE.code,
        accountName: `${COA.SALES_TAX_PAYABLE.name} - ${jurisdiction}`,
        description: `Collected sales tax payable to ${jurisdiction}`,
        debit: 0.00,
        credit: taxCents / 100,
        taxJurisdiction: jurisdiction,
      });
    }
  }

  return {
    bucketAOrders: orderLinked,
    bucketBDirect: directGateway,
    totalGrossCents,
    totalTaxCents,
    totalShippingCents,
    totalFeesCents,
    totalRefundsCents,
    totalReserveCents,
    totalNetCents: calculatedNetCents,
    synthesizedLines,
  };
}
