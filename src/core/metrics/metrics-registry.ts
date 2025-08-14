import {
  Counter,
  Histogram,
  Registry,
  collectDefaultMetrics,
} from 'prom-client';

export const registry = new Registry();
collectDefaultMetrics({ register: registry });

export const commandLatency = new Histogram({
  name: 'discord_command_latency_ms',
  help: 'Latency of Discord command handling in milliseconds',
  buckets: [50, 100, 200, 500, 1000, 2000, 5000],
  registers: [registry],
  labelNames: ['command'],
});

export const openaiErrors = new Counter({
  name: 'openai_request_errors_total',
  help: 'Count of OpenAI request errors',
  registers: [registry],
  labelNames: ['type'],
});

export const discordRateLimitHits = new Counter({
  name: 'discord_rate_limit_hits_total',
  help: 'Count of rate limit hits reported by Discord.js',
  registers: [registry],
});

export const commandSuccess = new Counter({
  name: 'discord_command_success_total',
  help: 'Count of successful Discord command executions',
  registers: [registry],
  labelNames: ['command'],
});

export const commandErrors = new Counter({
  name: 'discord_command_errors_total',
  help: 'Count of Discord command execution errors',
  registers: [registry],
  labelNames: ['command', 'type'],
});
