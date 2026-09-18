import { pgTable, text, varchar, timestamp, numeric, integer, jsonb, uuid } from 'drizzle-orm/pg-core';

/**
 * 1. Idempotency Locks
 * Drops at-least-once duplicate webhooks from payment processors.
 */
export const idempotencyLocks = pgTable('idempotency_locks', {
  payoutId: varchar('payout_id', { length: 128 }).primaryKey(),
  processor: varchar('processor', { length: 64 }).notNull(),
  status: varchar('status', { length: 32 }).notNull().default('PROCESSING'),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  lockedUntil: timestamp('locked_until', { withTimezone: true }).notNull(),
});

/**
 * 2. Payout Batches
 * Master settlement batch record tracking reconciliation status and dollar totals.
 */
export const payoutBatches = pgTable('payout_batches', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: varchar('batch_id', { length: 128 }).unique().notNull(),
  processor: varchar('processor', { length: 64 }).notNull(),
  payoutDate: timestamp('payout_date', { withTimezone: true }).notNull(),
  currency: varchar('currency', { length: 10 }).notNull().default('USD'),
  grossSales: numeric('gross_sales', { precision: 12, scale: 2 }).notNull(),
  taxCollected: numeric('tax_collected', { precision: 12, scale: 2 }).notNull(),
  processingFees: numeric('processing_fees', { precision: 12, scale: 2 }).notNull(),
  refunds: numeric('refunds', { precision: 12, scale: 2 }).notNull(),
  reserveWithheld: numeric('reserve_withheld', { precision: 12, scale: 2 }).notNull().default('0.00'),
  netDeposit: numeric('net_deposit', { precision: 12, scale: 2 }).notNull(),
  status: varchar('status', { length: 64 }).notNull().default('INGESTED'),
  retryCount: integer('retry_count').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 3. Ground Truth Records
 * Immutable audit snapshot of raw gateway transcripts used by the Math Gate.
 */
export const groundTruthRecords = pgTable('ground_truth_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: varchar('batch_id', { length: 128 }).references(() => payoutBatches.batchId).notNull(),
  rawPayload: jsonb('raw_payload').notNull(),
  gatewayNetDeposit: numeric('gateway_net_deposit', { precision: 12, scale: 2 }).notNull(),
  gatewayFeeTotal: numeric('gateway_fee_total', { precision: 12, scale: 2 }).notNull(),
  ingestedAt: timestamp('ingested_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 4. Ledger Journal Records
 * Individual double-entry line items verified by the Math Gate and staged for ERP sync.
 */
export const ledgerJournalRecords = pgTable('ledger_journal_records', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: varchar('batch_id', { length: 128 }).references(() => payoutBatches.batchId).notNull(),
  accountCode: varchar('account_code', { length: 10 }).notNull(),
  accountName: varchar('account_name', { length: 255 }).notNull(),
  description: text('description').notNull(),
  debit: numeric('debit', { precision: 12, scale: 2 }).notNull(),
  credit: numeric('credit', { precision: 12, scale: 2 }).notNull(),
  taxJurisdiction: varchar('tax_jurisdiction', { length: 64 }),
  stagingStatus: varchar('staging_status', { length: 32 }).notNull().default('PENDING'),
  erpJournalId: varchar('erp_journal_id', { length: 128 }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});

/**
 * 5. Audit Logs
 * Comprehensive forensic audit trail for CPA firms and compliance review.
 */
export const auditLogs = pgTable('audit_logs', {
  id: uuid('id').defaultRandom().primaryKey(),
  batchId: varchar('batch_id', { length: 128 }).notNull(),
  eventType: varchar('event_type', { length: 64 }).notNull(),
  details: jsonb('details').notNull(),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
});
