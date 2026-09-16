export interface TelemetryTraceParams {
  batchId: string;
  processor: string;
  attemptNumber: number;
  model: string;
  isMathValid: boolean;
  balanceDelta: number;
  waterfallDelta: number;
  latencyMs: number;
  violationsCount: number;
  firmId?: string;
}

/**
 * Audit & Token Telemetry Client
 * 
 * Records granular observability traces for every settlement deconstruction attempt.
 * Allows CAS accounting practices (like Basis 365) to monitor AI accuracy, token cost,
 * and zero-hallucination compliance.
 */
export class SettlementTelemetry {
  private publicKey?: string;
  private secretKey?: string;
  private host: string;

  constructor(env: { LANGFUSE_PUBLIC_KEY?: string; LANGFUSE_SECRET_KEY?: string; LANGFUSE_HOST?: string } = {}) {
    this.publicKey = env.LANGFUSE_PUBLIC_KEY;
    this.secretKey = env.LANGFUSE_SECRET_KEY;
    this.host = env.LANGFUSE_HOST || 'https://cloud.langfuse.com';
  }

  /**
   * Records a deconstruction attempt trace.
   */
  async recordTrace(params: TelemetryTraceParams): Promise<void> {
    const timestamp = new Date().toISOString();

    const traceData = {
      timestamp,
      environment: 'production',
      metadata: {
        batchId: params.batchId,
        processor: params.processor,
        attemptNumber: params.attemptNumber,
        model: params.model,
        isMathValid: params.isMathValid,
        balanceDeltaCents: Math.round(params.balanceDelta * 100),
        waterfallDeltaCents: Math.round(params.waterfallDelta * 100),
        latencyMs: params.latencyMs,
        violationsCount: params.violationsCount,
        firmId: params.firmId || 'basis-365-accounting',
      },
    };

    // If Langfuse API keys are configured, send to remote observability ingest
    if (this.publicKey && this.secretKey) {
      try {
        const auth = btoa(`${this.publicKey}:${this.secretKey}`);
        await fetch(`${this.host}/api/public/ingestion`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Basic ${auth}`,
          },
          body: JSON.stringify({
            batch: [
              {
                id: crypto.randomUUID(),
                type: 'trace-create',
                timestamp,
                body: {
                  name: `settlement-deconstruct-${params.processor.toLowerCase()}`,
                  sessionId: params.batchId,
                  userId: params.firmId || 'basis-365-accounting',
                  metadata: traceData.metadata,
                },
              },
            ],
          }),
        });
      } catch (err) {
        console.warn('[Telemetry] Failed to post remote trace:', err);
      }
    } else {
      // Local development fallback: structured audit logging
      console.log(`[Telemetry Trace] Batch ${params.batchId} | Attempt ${params.attemptNumber} | Math Valid: ${params.isMathValid} | Δ: $${params.balanceDelta.toFixed(2)} | Latency: ${params.latencyMs}ms`);
    }
  }
}
