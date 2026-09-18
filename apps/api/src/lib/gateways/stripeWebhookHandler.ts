import crypto from 'crypto';
import { 
  classifyTwoBucketTransactions, 
  OrderLinkedTransaction, 
  DirectGatewayTransaction,
  TwoBucketClassificationResult 
} from './twoBucketClassifier';
import { DeconstructedPayout } from '@settlement-agent/shared';

export interface StripeWebhookEvent {
  id: string;
  type: string; // e.g. "payout.paid"
  created: number;
  data: {
    object: {
      id: string; // "po_123456789"
      amount: number; // in cents, e.g. 1049000 ($10,490.00)
      currency: string;
      arrival_date: number;
      status: string; // "paid"
      description?: string;
      metadata?: Record<string, string>;
    };
  };
}

/**
 * Verifies Stripe Webhook HMAC-SHA256 Signature
 * Header format: "t=1492774577,v1=5257a869e7ecebeda32affa62cd496264e5481423a22ff75975e29845449bcf4"
 */
export function verifyStripeSignature(
  rawBody: string,
  signatureHeader: string,
  secret: string,
  toleranceSeconds: number = 300
): boolean {
  if (!signatureHeader || !secret) return false;

  const items = signatureHeader.split(',').reduce((acc, item) => {
    const [key, val] = item.split('=');
    if (key && val) acc[key.trim()] = val.trim();
    return acc;
  }, {} as Record<string, string>);

  const timestamp = items['t'];
  const expectedSig = items['v1'];

  if (!timestamp || !expectedSig) return false;

  // Verify timestamp within tolerance
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(timestamp, 10)) > toleranceSeconds) {
    return false; // Replay attack protection
  }

  const payloadToSign = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadToSign, 'utf8');
  const digest = hmac.digest('hex');

  return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(expectedSig));
}

/**
 * Creates a valid test signature for development and E2E testing
 */
export function generateTestStripeSignature(rawBody: string, secret: string): string {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const payloadToSign = `${timestamp}.${rawBody}`;
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadToSign, 'utf8');
  const digest = hmac.digest('hex');
  return `t=${timestamp},v1=${digest}`;
}

export interface IngestedStripeSettlement {
  payoutId: string;
  payoutDate: string;
  currency: string;
  netDeposit: number; // in dollars (e.g. 10490.00)
  netDepositCents: number;
  rawEvent: StripeWebhookEvent;
  classification: TwoBucketClassificationResult;
  deconstructedPayout: DeconstructedPayout;
}

/**
 * Ingests a Stripe payout.paid event with linked Bucket A and Bucket B transactions
 */
export function ingestStripePayoutEvent(
  event: StripeWebhookEvent,
  linkedOrders: OrderLinkedTransaction[] = [],
  directTransactions: DirectGatewayTransaction[] = []
): IngestedStripeSettlement {
  const payoutObj = event.data.object;
  const payoutId = payoutObj.id;
  const netDepositCents = payoutObj.amount;
  const netDepositDollars = netDepositCents / 100;
  
  const payoutDate = new Date(payoutObj.arrival_date * 1000)
    .toISOString()
    .split('T')[0];

  const currency = (payoutObj.currency || 'USD').toUpperCase();

  // Run the Two-Bucket Classifier
  const classification = classifyTwoBucketTransactions(
    linkedOrders,
    directTransactions,
    netDepositCents
  );

  const deconstructedPayout: DeconstructedPayout = {
    batchId: payoutId,
    processor: 'STRIPE',
    payoutDate,
    currency,
    grossSales: (classification.totalGrossCents + classification.totalShippingCents) / 100,
    taxCollected: classification.totalTaxCents / 100,
    processingFees: classification.totalFeesCents / 100,
    refunds: classification.totalRefundsCents / 100,
    reserveWithheld: classification.totalReserveCents / 100,
    netDeposit: netDepositDollars,
    lines: classification.synthesizedLines,
    confidenceScore: 1.0,
  };

  return {
    payoutId,
    payoutDate,
    currency,
    netDeposit: netDepositDollars,
    netDepositCents,
    rawEvent: event,
    classification,
    deconstructedPayout,
  };
}
