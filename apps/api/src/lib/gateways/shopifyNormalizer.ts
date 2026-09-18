import { OrderLinkedTransaction } from './twoBucketClassifier';

export interface ShopifyTaxLine {
  title: string;       // e.g. "California State Tax", "New York County Tax"
  price: string;       // e.g. "14.50"
  rate: number;        // e.g. 0.0725
}

export interface ShopifyShippingLine {
  title: string;       // e.g. "Standard Ground"
  price: string;       // e.g. "12.00"
}

export interface ShopifyOrderPayload {
  id: number | string;
  name: string;        // e.g. "#1092"
  total_price: string; // e.g. "150.00"
  subtotal_price: string; // e.g. "123.50"
  total_tax: string;   // e.g. "14.50"
  tax_lines?: ShopifyTaxLine[];
  shipping_lines?: ShopifyShippingLine[];
  financial_status: string; // e.g. "paid"
  currency: string;
}

/**
 * Normalizes raw Shopify Order JSON into structured OrderLinkedTransaction
 */
export function normalizeShopifyOrder(
  order: ShopifyOrderPayload,
  gatewayFeeCents: number = 0
): OrderLinkedTransaction {
  const grossCents = Math.round(parseFloat(order.total_price || '0') * 100);
  
  // Calculate shipping cents
  let shippingCents = 0;
  if (order.shipping_lines && order.shipping_lines.length > 0) {
    for (const ship of order.shipping_lines) {
      shippingCents += Math.round(parseFloat(ship.price || '0') * 100);
    }
  }

  // Deconstruct tax lines by jurisdiction
  const taxes: OrderLinkedTransaction['taxes'] = [];
  if (order.tax_lines && order.tax_lines.length > 0) {
    for (const tax of order.tax_lines) {
      const taxAmountCents = Math.round(parseFloat(tax.price || '0') * 100);
      let jurisdiction = 'US-GENERIC';
      const upper = tax.title.toUpperCase();
      if (upper.includes('CALIFORNIA') || upper.includes('CA')) {
        jurisdiction = 'CA-CDTFA';
      } else if (upper.includes('NEW YORK') || upper.includes('NY')) {
        jurisdiction = 'NY-DTF';
      } else if (upper.includes('TEXAS') || upper.includes('TX')) {
        jurisdiction = 'TX-COMPTROLLER';
      } else if (upper.includes('FLORIDA') || upper.includes('FL')) {
        jurisdiction = 'FL-DOR';
      } else {
        jurisdiction = tax.title.replace(/\s+/g, '-').toUpperCase();
      }

      taxes.push({
        jurisdiction,
        rate: tax.rate,
        amount: taxAmountCents,
      });
    }
  }

  const netCents = grossCents - gatewayFeeCents;

  return {
    id: `shp_trans_${order.id}`,
    sourceOrderId: String(order.name || order.id),
    grossAmount: grossCents,
    feeAmount: gatewayFeeCents,
    netAmount: netCents,
    shippingAmount: shippingCents,
    taxes,
  };
}
