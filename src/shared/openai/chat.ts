import OpenAI from 'openai';

import openai from '../../utils/openai-client';
import {
  openaiErrors,
  responsesInputTokens,
  responsesOutputTokens,
  openaiHttpErrors,
} from '../../core/metrics/metrics-registry';

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
  conversation?: 'auto' | { id: string };
  enableWebSearch?: boolean;
}

export interface ChatResponse {
  content: string | null;
  conversationId?: string;
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
    conversation,
  } = options;

  // Map ChatCompletion-style messages to Responses API fields
  // - Aggregate system messages into a single `instructions` string
  // - Map user/assistant messages into structured `input` items
  const systemInstructions: string = messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => String(m.content))
    .join('\n');

  const nonSystem = messages.filter((m) => m.role !== 'system');

  // Build a plain text conversation input to avoid schema mismatches.
  const conversationText: string = nonSystem
    .map((m) => {
      const prefix = m.role === 'assistant' ? 'Assistant' : 'User';
      const text: string =
        typeof m.content === 'string'
          ? m.content
          : Array.isArray(m.content)
            ? m.content
                .map((c: string | { text?: string }) =>
                  typeof c === 'string' ? c : (c?.text ?? ''),
                )
                .join('\n')
            : String(m.content ?? '');
      return `${prefix}: ${text}`;
    })
    .join('\n');

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    try {
      const isGpt5: boolean =
        typeof model === 'string' && model.toLowerCase().startsWith('gpt-5');

      const payload: Record<string, unknown> = {
        model,
        // Only include instructions if any system content exists
        ...(systemInstructions ? { instructions: systemInstructions } : {}),
        input: conversationText || undefined,
        // Prefer the Responses naming for token limits
        max_output_tokens: maxCompletionTokens,
        // Only include conversation if a valid id is provided
        ...(conversation &&
        typeof conversation === 'object' &&
        'id' in conversation
          ? { conversation }
          : {}),
        ...(options.enableWebSearch ||
        String(process.env.WEB_SEARCH_ENABLED).toLowerCase() === 'true'
          ? {
              tool_choice: 'auto',
              tools: [{ type: 'web_search' }],
            }
          : {}),
      };

      // Some models (e.g., gpt-5) ignore sampling parameters; match prior behavior
      if (!isGpt5) {
        Object.assign(payload, {
          temperature,
          frequency_penalty: frequencyPenalty,
          presence_penalty: presencePenalty,
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const response: any = await openai.responses.create(payload as any, {
          signal: controller.signal,
        });
        // Prefer `output_text` if populated; otherwise try to extract first text output
        const content: string | null =
          response?.output_text?.trim?.() ??
          extractFirstTextFromResponse(response);
        const convId: string | undefined =
          response?.conversation?.id ?? undefined;
        try {
          const usage = response?.usage ?? {};
          const input = Number(usage.input_tokens ?? usage.input ?? 0);
          const output = Number(usage.output_tokens ?? usage.output ?? 0);
          if (!Number.isNaN(input) && input > 0) {
            responsesInputTokens.inc({ model }, input);
          }
          if (!Number.isNaN(output) && output > 0) {
            responsesOutputTokens.inc({ model }, output);
          }
        } catch {}
        return { content, conversationId: convId };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      try {
        openaiErrors.inc({ type: 'error' });
      } catch {}
      try {
        const status =
          (error as any)?.status || (error as any)?.response?.status;
        if (status) openaiHttpErrors.inc({ status: String(status) });
      } catch {}
      lastError = error;
      const jitter = Math.random() * 100;
      const delayMs = 250 * Math.pow(2, attempt) + jitter;
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
  throw lastError;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function extractFirstTextFromResponse(res: any): string | null {
  try {
    if (res?.output_text) {
      return typeof res.output_text === 'string'
        ? res.output_text.trim()
        : String(res.output_text);
    }
    // Fallback: walk typical Responses shapes to find first text segment
    const outputs = res?.output ?? res?.response?.output ?? undefined;
    if (Array.isArray(outputs) && outputs.length > 0) {
      for (const item of outputs) {
        if (item?.content && Array.isArray(item.content)) {
          for (const part of item.content) {
            if (
              part?.type === 'output_text' &&
              typeof part?.text === 'string'
            ) {
              return part.text.trim();
            }
            if (typeof part?.text === 'string') {
              return part.text.trim();
            }
          }
        }
      }
    }
  } catch {
    // ignore
  }
  return null;
}
