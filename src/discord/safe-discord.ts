import { Logger } from '@nestjs/common';
import { ChatInputCommandInteraction } from 'discord.js';

import { ResilienceOptions } from './decorators/discord-resilience.decorator';

interface BackoffOptions {
  retries: number;
  baseMs: number;
  maxMs: number;
  timeoutMs: number;
}

const defaultBackoff: BackoffOptions = {
  retries: 2,
  baseMs: 500,
  maxMs: 5_000,
  timeoutMs: 10_000,
};

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
): Promise<T> {
  let timeoutHandle: NodeJS.Timeout | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(
      () => reject(new Error('discord-call-timeout')),
      timeoutMs,
    );
  });
  try {
    return await Promise.race([promise, timeoutPromise]);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  logger: Logger,
  opts: BackoffOptions,
): Promise<T> {
  let attempt = 0;
  let lastErr: unknown = undefined;
  while (attempt <= opts.retries) {
    try {
      return await withTimeout(fn(), opts.timeoutMs);
    } catch (err) {
      lastErr = err;
      const delay = Math.min(
        opts.baseMs * Math.pow(2, attempt) + Math.random() * 100,
        opts.maxMs,
      );
      logger.warn(
        `Discord call failed (attempt ${attempt + 1}/${opts.retries + 1}). Retrying in ${delay}ms.`,
      );
      await sleep(delay);
      attempt++;
    }
  }
  throw lastErr;
}

export function withSafeInteraction(
  interaction: ChatInputCommandInteraction,
  logger: Logger,
  options: Partial<BackoffOptions | ResilienceOptions> = {},
): ChatInputCommandInteraction {
  const opts: BackoffOptions = { ...defaultBackoff, ...options };
  const methodsToWrap = new Set([
    'reply',
    'followUp',
    'editReply',
    'deferReply',
  ]);

  // Proxy to wrap selected methods with timeout + retry
  const proxy = new Proxy(interaction, {
    get(
      target: ChatInputCommandInteraction,
      prop: PropertyKey,
      receiver: unknown,
    ): unknown {
      const original = Reflect.get(target, prop, receiver);
      if (
        typeof prop === 'string' &&
        methodsToWrap.has(prop) &&
        typeof original === 'function'
      ) {
        return (...args: unknown[]) =>
          retryWithBackoff(() => original.apply(target, args), logger, opts);
      }
      return original;
    },
  });

  return proxy;
}
