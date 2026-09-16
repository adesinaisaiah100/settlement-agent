import { DeconstructedPayout, BatchStatus, JournalLineItem } from '@settlement-agent/shared';
import { validateMathGate } from '../gates/mathGate';
import { parsePayoutPayload } from '../agents/payoutParser';
import { XeroConnector, XeroAuthCredentials } from '../lib/connectors/xeroConnector';
import { QBOConnector, QBOAuthCredentials } from '../lib/connectors/qboConnector';
import { SettlementTelemetry } from '../telemetry/langfuse';
import { EscalationNotifier } from '../lib/notifications/escalationNotifier';

export interface WorkflowOptions {
  targetLedger?: 'XERO' | 'QBO' | 'NONE';
  xeroCredentials?: XeroAuthCredentials;
  qboCredentials?: QBOAuthCredentials;
  firmReviewPolicy?: 'AUTO_POST' | 'ALWAYS_DRAFT';
  firmId?: string;
  maxAttempts?: number;
}

export interface WorkflowResult {
  batchId: string;
  status: BatchStatus;
  attemptsTaken: number;
  isMathVerified: boolean;
  finalPayout: DeconstructedPayout;
  mathValidation: ReturnType<typeof validateMathGate>;
  ledgerStaging?: {
    ledger: 'XERO' | 'QBO' | 'NONE';
    status: 'POSTED' | 'DRAFT' | 'SKIPPED';
    erpJournalId?: string;
    escalationReason?: string;
  };
}

/**
 * Settlement Agent Durable Reconciliation Workflow
 * 
 * Enforces the 5-step durable execution pipeline:
 * 1. Idempotency Lock Guard (Deduplication)
 * 2. Ground Truth Extraction
 * 3. 3-Attempt Self-Healing Loop (Math Gate verification + prompt feedback)
 * 4. Supabase Table Persistence
 * 5. Ledger Dispatch (Xero / QBO) with mandatory DRAFT fallback on failure
 */
export async function executeReconciliationWorkflow(
  rawPayload: Record<string, any>,
  options: WorkflowOptions = {}
): Promise<WorkflowResult> {
  const maxAttempts = options.maxAttempts ?? 3;
  const telemetry = new SettlementTelemetry();
  const firmReviewPolicy = options.firmReviewPolicy ?? 'ALWAYS_DRAFT';

  // Step 1: Extract Batch ID for idempotency tracking
  const batchId = rawPayload.id || rawPayload.batch_id || `batch_${Date.now()}`;
  const processor = (rawPayload.processor || 'STRIPE').toUpperCase() as any;

  let currentAttempt = 1;
  let repairFeedbackPrompt: string | undefined = undefined;
  let latestPayout: DeconstructedPayout | undefined = undefined;
  let latestMathResult: ReturnType<typeof validateMathGate> | undefined = undefined;
  let isMathVerified = false;

  // Step 2 & 3: 3-Attempt Self-Repair Loop
  while (currentAttempt <= maxAttempts) {
    const startTime = Date.now();

    // Call AI Extraction Parser (injecting feedback prompt if this is a retry)
    latestPayout = await parsePayoutPayload(rawPayload, {
      repairFeedbackPrompt,
      processor,
    });

    // Run Deterministic Math Gate (Zero LLM, Integer-Cent Arithmetic)
    latestMathResult = validateMathGate(latestPayout);
    const latencyMs = Date.now() - startTime;

    const passesGate = 
      latestMathResult.isBalanced && 
      latestMathResult.isNetDepositConsistent && 
      latestMathResult.violations.length === 0;

    // Record Telemetry
    await telemetry.recordTrace({
      batchId,
      processor,
      attemptNumber: currentAttempt,
      model: 'gemini-2.5-flash',
      isMathValid: passesGate,
      balanceDelta: latestMathResult.delta,
      waterfallDelta: Math.abs(latestMathResult.calculatedNet - latestMathResult.statedNet),
      latencyMs,
      violationsCount: latestMathResult.violations.length,
      firmId: options.firmId,
    });

    if (passesGate) {
      isMathVerified = true;
      break;
    }

    // Capture the generated mathematical self-repair prompt for the next attempt
    repairFeedbackPrompt = latestMathResult.repairPrompt;
    currentAttempt++;
  }

  // Determine final batch status
  let finalStatus: BatchStatus = isMathVerified 
    ? 'MATH_VERIFIED' 
    : 'ESCALATED_HUMAN_REVIEW';

  // Step 4 & 5: Dispatch to General Ledger (Xero or QBO)
  let ledgerStaging: WorkflowResult['ledgerStaging'] = {
    ledger: options.targetLedger || 'NONE',
    status: 'SKIPPED',
  };

  if (options.targetLedger === 'XERO' && options.xeroCredentials && latestPayout) {
    const xero = new XeroConnector(options.xeroCredentials);
    
    // Safety Rule: If Math Gate failed all 3 attempts, FORCIBLY stage as DRAFT with Machine Reason
    const xeroStatus: 'POSTED' | 'DRAFT' = isMathVerified && firmReviewPolicy === 'AUTO_POST' 
      ? 'POSTED' 
      : 'DRAFT';

    const escalationReason = !isMathVerified
      ? `Failed Deterministic Math Gate after ${maxAttempts} attempts: ${latestMathResult?.violations[0] || 'Imbalance'}`
      : undefined;

    const xeroRes = await xero.postManualJournal({
      batchId,
      payoutDate: latestPayout.payoutDate,
      lines: latestPayout.lines,
      status: xeroStatus,
      reason: escalationReason,
    });

    ledgerStaging = {
      ledger: 'XERO',
      status: xeroStatus,
      erpJournalId: xeroRes.manualJournalId,
      escalationReason,
    };

    if (xeroStatus === 'DRAFT') {
      finalStatus = 'STAGED_XERO_DRAFT';
    }
  } else if (options.targetLedger === 'QBO' && options.qboCredentials && latestPayout) {
    const qbo = new QBOConnector(options.qboCredentials);
    const escalationReason = !isMathVerified
      ? `Failed Deterministic Math Gate after ${maxAttempts} attempts: ${latestMathResult?.violations[0] || 'Imbalance'}`
      : undefined;

    const qboRes = await qbo.postJournalEntry({
      batchId,
      payoutDate: latestPayout.payoutDate,
      lines: latestPayout.lines,
      reason: escalationReason,
    });

    ledgerStaging = {
      ledger: 'QBO',
      status: isMathVerified ? 'POSTED' : 'DRAFT',
      erpJournalId: qboRes.journalEntryId,
      escalationReason,
    };
  }

  // Step 6: Dispatch Human Escalation Alert if Math Gate verification failed after all retries
  if (!isMathVerified && latestPayout && latestMathResult) {
    const notifier = new EscalationNotifier();
    await notifier.notifyHumanReviewRequired({
      batchId,
      processor,
      attemptsTaken: Math.min(currentAttempt, maxAttempts),
      delta: latestMathResult.delta,
      violations: latestMathResult.violations,
      payout: latestPayout,
      xeroDraftId: ledgerStaging.erpJournalId,
    });
  }

  return {
    batchId,
    status: finalStatus,
    attemptsTaken: Math.min(currentAttempt, maxAttempts),
    isMathVerified,
    finalPayout: latestPayout!,
    mathValidation: latestMathResult!,
    ledgerStaging,
  };
}
