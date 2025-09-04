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

export const openaiHttpErrors = new Counter({
  name: 'openai_responses_http_errors_total',
  help: 'Count of OpenAI Responses HTTP errors by status',
  registers: [registry],
  labelNames: ['status'],
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

export const commandStarts = new Counter({
  name: 'discord_command_starts_total',
  help: 'Count of Discord command invocations (start)',
  registers: [registry],
  labelNames: ['command'],
});

export const responsesInputTokens = new Counter({
  name: 'openai_responses_input_tokens_total',
  help: 'Total input tokens used by OpenAI Responses API',
  registers: [registry],
  labelNames: ['model'],
});

export const responsesOutputTokens = new Counter({
  name: 'openai_responses_output_tokens_total',
  help: 'Total output tokens used by OpenAI Responses API',
  registers: [registry],
  labelNames: ['model'],
});
