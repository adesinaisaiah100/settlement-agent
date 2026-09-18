import { serve } from '@hono/node-server';
import app from './index';

const port = Number(process.env.PORT) || 8787;

console.log(`\n======================================================`);
console.log(`🚀 Settlement Agent API Server Running`);
console.log(`📡 Endpoint  : http://localhost:${port}`);
console.log(`⚡ Health    : http://localhost:${port}/health`);
console.log(`🧪 Simulation: http://localhost:${port}/api/webhooks/simulate-settlement`);
console.log(`======================================================\n`);

serve({
  fetch: app.fetch,
  port,
});
