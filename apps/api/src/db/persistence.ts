import { DeconstructedPayout, BatchStatus } from '@settlement-agent/shared';

export interface PersistenceResult {
  payoutId: string;
  isDuplicate: boolean;
  persistedBatchId?: string;
  linesCount: number;
  tablesUpdated: string[];
}

export interface InMemoryDbState {
  idempotencyLocks: Map<string, { status: string; lockedUntil: Date }>;
  payoutBatches: Map<string, any>;
  groundTruthRecords: Map<string, any>;
  ledgerJournalRecords: Array<any>;
  auditLogs: Array<any>;
}

/**
 * Global In-Memory Store for fast, isolated test and staging execution
 */
export const memoryDb: InMemoryDbState = {
  idempotencyLocks: new Map(),
  payoutBatches: new Map(),
  groundTruthRecords: new Map(),
  ledgerJournalRecords: [],
  auditLogs: [],
};

/**
 * Database Persistence Layer for Supabase (5 tables)
 */
export class SettlementPersistenceService {
  /**
   * 1. Check and Acquire Idempotency Lock
   */
  async acquireIdempotencyLock(payoutId: string, processor: string = 'STRIPE'): Promise<boolean> {
    const existing = memoryDb.idempotencyLocks.get(payoutId);
    if (existing) {
      if (existing.status === 'COMPLETED' || existing.lockedUntil > new Date()) {
        return false; // Duplicate detected, drop transaction
      }
    }

    const lockedUntil = new Date(Date.now() + 5 * 60 * 1000); // 5 minute lock
    memoryDb.idempotencyLocks.set(payoutId, {
      status: 'PROCESSING',
      lockedUntil,
    });
    return true;
  }

  /**
   * Complete Idempotency Lock
   */
  async completeIdempotencyLock(payoutId: string): Promise<void> {
    const existing = memoryDb.idempotencyLocks.get(payoutId);
    if (existing) {
      existing.status = 'COMPLETED';
    }
  }

  /**
   * 2, 3, 4, 5. Persist Full Reconciliation Batch to Supabase Tables
   */
  async persistReconciliationBatch(params: {
    payout: DeconstructedPayout;
    rawPayload: Record<string, any>;
    status: BatchStatus;
    attemptsTaken: number;
    auditDetails: Record<string, any>;
    erpJournalId?: string;
  }): Promise<PersistenceResult> {
    const { payout, rawPayload, status, attemptsTaken, auditDetails, erpJournalId } = params;
    const batchId = payout.batchId;
    const tablesUpdated: string[] = [];

    // Table 2: payout_batches
    const batchRecord = {
      batchId,
      processor: payout.processor,
      payoutDate: new Date(payout.payoutDate),
      currency: payout.currency,
      grossSales: payout.grossSales.toFixed(2),
      taxCollected: payout.taxCollected.toFixed(2),
      processingFees: payout.processingFees.toFixed(2),
      refunds: payout.refunds.toFixed(2),
      reserveWithheld: payout.reserveWithheld.toFixed(2),
      netDeposit: payout.netDeposit.toFixed(2),
      status,
      retryCount: attemptsTaken,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    memoryDb.payoutBatches.set(batchId, batchRecord);
    tablesUpdated.push('payout_batches');

    // Table 3: ground_truth_records
    const groundTruthRecord = {
      batchId,
      rawPayload,
      gatewayNetDeposit: payout.netDeposit.toFixed(2),
      gatewayFeeTotal: payout.processingFees.toFixed(2),
      ingestedAt: new Date(),
    };
    memoryDb.groundTruthRecords.set(batchId, groundTruthRecord);
    tablesUpdated.push('ground_truth_records');

    // Table 4: ledger_journal_records
    for (const line of payout.lines) {
      const lineRecord = {
        batchId,
        accountCode: line.accountCode,
        accountName: line.accountName,
        description: line.description,
        debit: line.debit.toFixed(2),
        credit: line.credit.toFixed(2),
        taxJurisdiction: line.taxJurisdiction || null,
        stagingStatus: status === 'MATH_VERIFIED' ? 'POSTED' : 'DRAFT',
        erpJournalId: erpJournalId || null,
        createdAt: new Date(),
      };
      memoryDb.ledgerJournalRecords.push(lineRecord);
    }
    tablesUpdated.push('ledger_journal_records');

    // Table 5: audit_logs
    const auditRecord = {
      batchId,
      eventType: `RECONCILIATION_${status}`,
      details: {
        ...auditDetails,
        linesCount: payout.lines.length,
        persistedTimestamp: new Date().toISOString(),
      },
      createdAt: new Date(),
    };
    memoryDb.auditLogs.push(auditRecord);
    tablesUpdated.push('audit_logs');

    // Complete lock
    await this.completeIdempotencyLock(batchId);
    tablesUpdated.push('idempotency_locks');

    return {
      payoutId: batchId,
      isDuplicate: false,
      persistedBatchId: batchId,
      linesCount: payout.lines.length,
      tablesUpdated,
    };
  }

  /**
   * Helper to inspect stored database state
   */
  getSnapshot(batchId: string) {
    return {
      batch: memoryDb.payoutBatches.get(batchId),
      groundTruth: memoryDb.groundTruthRecords.get(batchId),
      journalLines: memoryDb.ledgerJournalRecords.filter(l => l.batchId === batchId),
      auditLogs: memoryDb.auditLogs.filter(a => a.batchId === batchId),
      lock: memoryDb.idempotencyLocks.get(batchId),
    };
  }

  clear() {
    memoryDb.idempotencyLocks.clear();
    memoryDb.payoutBatches.clear();
    memoryDb.groundTruthRecords.clear();
    memoryDb.ledgerJournalRecords.length = 0;
    memoryDb.auditLogs.length = 0;
  }
}
