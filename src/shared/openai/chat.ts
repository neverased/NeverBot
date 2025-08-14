import OpenAI from 'openai';

import openai from '../../utils/openai-client';
import { openaiErrors } from '../../core/metrics/metrics-registry';

export interface ChatMessageParam {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface ChatRequestOptions {
  temperature?: number;
  maxCompletionTokens?: number;
  frequencyPenalty?: number;
  presencePenalty?: number;
  model?: string;
  retryCount?: number;
}

export interface ChatResponse {
  content: string | null;
}

/**
 * Execute a chat completion with sane defaults and retry/backoff.
 */
export async function callChatCompletion(
  messages: Array<OpenAI.Chat.ChatCompletionMessageParam>,
  options: ChatRequestOptions = {},
): Promise<ChatResponse> {
  const {
    temperature = 1,
    maxCompletionTokens = 1024,
    frequencyPenalty = 0,
    presencePenalty = 0,
    model = 'gpt-4o-mini',
    retryCount = 2,
  } = options;

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const payload: any = {
        model,
        messages,
        max_completion_tokens: maxCompletionTokens,
        frequency_penalty: frequencyPenalty,
        presence_penalty: presencePenalty,
      };
      // Some models only allow default temperature; omit if not 1
      if (temperature === 1) {
        payload.temperature = temperature;
      }
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const completion = await openai.chat.completions.create(payload, {
          signal: controller.signal,
        });
        return {
          content: completion.choices[0]?.message?.content?.trim() ?? null,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      try {
        openaiErrors.inc({ type: 'error' });
      } catch {}
      lastError = error;
      // Exponential backoff: 250ms, 500ms, 1000ms ...
      const jitter = Math.random() * 100;
      const delayMs = 250 * Math.pow(2, attempt) + jitter;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  // Bubble up after retries
  throw lastError;
}
