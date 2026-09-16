import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { validateMathGate } from './gates/mathGate';
import { parsePayoutPayload } from './agents/payoutParser';
import { DeconstructedPayoutSchema } from '@settlement-agent/shared';
import webhooks from './routes/webhooks';

const app = new Hono();

app.use('*', cors());

// Gateway Webhooks (Stripe payout.paid, Shopify feeds, Settlement simulations)
app.route('/api/webhooks', webhooks);

app.get('/health', (c) => {
  return c.json({
    status: 'healthy',
    service: 'Settlement Agent API',
    timestamp: new Date().toISOString(),
  });
});

/**
 * Direct Math Gate Validation Endpoint
 * Pure deterministic validation: zero LLM inference.
 */
app.post('/api/validate-math', async (c) => {
  try {
    const body = await c.req.json();
    const parsed = DeconstructedPayoutSchema.safeParse(body);

    if (!parsed.success) {
      return c.json({
        error: 'Invalid payout schema payload',
        details: parsed.error.issues,
      }, 400);
    }

    const validationResult = validateMathGate(parsed.data);
    return c.json(validationResult);
  } catch (error: any) {
    return c.json({ error: error.message || 'Internal server error' }, 500);
  }
});

/**
 * Reconciliation Ingestion Endpoint
 * Runs the AI parser and validates through the Math Gate.
 */
app.post('/api/reconcile', async (c) => {
  try {
    const rawPayload = await c.req.json();

    // Step 1: AI Extraction Agent deconstruction
    const deconstructed = await parsePayoutPayload(rawPayload);

    // Step 2: Deterministic Math Gate Validation
    const mathResult = validateMathGate(deconstructed);

    return c.json({
      payout: deconstructed,
      mathVerification: mathResult,
    });
  } catch (error: any) {
    return c.json({ error: error.message || 'Reconciliation failed' }, 500);
  }
});

export default app;
