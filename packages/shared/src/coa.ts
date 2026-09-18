/**
 * Standard Chart of Accounts (COA) Architecture for Settlement Agent
 * Strictly follows US GAAP 5-digit hierarchy
 */

export const COA = {
  // 10000 - ASSETS
  OPERATING_CASH: { code: '10100', name: 'Operating Checking Account', type: 'ASSET', normalBalance: 'DEBIT' },
  CLEARING_STRIPE: { code: '11500', name: 'Stripe Payout Clearing Account', type: 'ASSET', normalBalance: 'DEBIT' },
  CLEARING_SHOPIFY: { code: '11510', name: 'Shopify Payments Clearing', type: 'ASSET', normalBalance: 'DEBIT' },
  GATEWAY_RESERVE_RECEIVABLE: { code: '11600', name: 'Merchant Gateway Reserve Receivable', type: 'ASSET', normalBalance: 'DEBIT' },
  ACCOUNTS_RECEIVABLE: { code: '12000', name: 'Accounts Receivable', type: 'ASSET', normalBalance: 'DEBIT' },

  // 20000 - LIABILITIES
  ACCOUNTS_PAYABLE: { code: '20100', name: 'Accounts Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  SALES_TAX_PAYABLE: { code: '22000', name: 'Sales Tax Agency Payable', type: 'LIABILITY', normalBalance: 'CREDIT' },
  DEFERRED_REVENUE: { code: '23000', name: 'Deferred Unearned Revenue', type: 'LIABILITY', normalBalance: 'CREDIT' },

  // 30000 - EQUITY
  OWNERS_EQUITY: { code: '30100', name: "Owner's Equity Capital", type: 'EQUITY', normalBalance: 'CREDIT' },
  RETAINED_EARNINGS: { code: '32000', name: 'Retained Earnings', type: 'EQUITY', normalBalance: 'CREDIT' },

  // 40000 - REVENUE
  GROSS_SALES_ECOM: { code: '40100', name: 'Gross E-Commerce Sales', type: 'REVENUE', normalBalance: 'CREDIT' },
  SHIPPING_INCOME: { code: '41000', name: 'Shipping & Delivery Income', type: 'REVENUE', normalBalance: 'CREDIT' },
  RETURNS_AND_ALLOWANCES: { code: '49000', name: 'Sales Returns & Customer Refunds', type: 'CONTRA_REVENUE', normalBalance: 'DEBIT' },

  // 50000 - COST OF GOODS SOLD / COST OF SERVICES
  MERCHANT_PROCESSING_FEES: { code: '52000', name: 'Merchant Payment Processing Fees', type: 'COGS', normalBalance: 'DEBIT' },
  DISPUTE_CHARGEBACK_FEES: { code: '52100', name: 'Gateway Dispute & Chargeback Fees', type: 'COGS', normalBalance: 'DEBIT' },

  // 60000 - OPERATING EXPENSES
  GENERAL_EXPENSE_SUSPENSE: { code: '69999', name: 'Ask My Accountant / Uncategorized', type: 'OPEX', normalBalance: 'DEBIT' }
} as const;

export type AccountCode = typeof COA[keyof typeof COA]['code'];
export type AccountRecord = typeof COA[keyof typeof COA];
