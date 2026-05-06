import OpenAI from 'openai';
import { zodTextFormat } from 'openai/helpers/zod';
import type {
  EasyInputMessage,
  ResponseCreateParamsNonStreaming,
  ResponseInput,
  ResponseTextConfig,
  ResponseUsage,
  Tool,
} from 'openai/resources/responses/responses';
import type { z } from 'zod';

import {
  openaiErrors,
  openaiHttpErrors,
  openaiResponseLatency,
  openaiResponseStatus,
  responsesCachedInputTokens,
  responsesInputTokens,
  responsesOutputTokens,
  responsesReasoningOutputTokens,
} from '../../core/metrics/metrics-registry';
import openai from './client';
import {
  getOpenAiFlowPolicy,
  OpenAiFlow,
  ReasoningEffort,
} from './model-policy';

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
  previousResponseId?: string;
  conversation?: { id: string };
  enableWebSearch?: boolean;
  reasoning?: { effort: ReasoningEffort };
  text?: Pick<ResponseTextConfig, 'verbosity'>;
  flow?: OpenAiFlow;
  promptCacheKey?: string;
  store?: boolean;
  metadata?: Record<string, string>;
}

export interface ChatResponse {
  content: string | null;
  conversationId?: string;
}

export interface StructuredChatResponse<T> extends ChatResponse {
  parsed: T | null;
}

/**
 * Execute a chat completion with sane defaults and retry/backoff.
 */
export async function callChatCompletion(
  messages: Array<OpenAI.Chat.ChatCompletionMessageParam>,
  options: ChatRequestOptions = {},
): Promise<ChatResponse> {
  const flow = options.flow ?? 'chat';
  const policy = getOpenAiFlowPolicy(flow);
  const {
    temperature = 1,
    maxCompletionTokens = policy.maxCompletionTokens,
    frequencyPenalty = 0,
    presencePenalty = 0,
    model = policy.model,
    retryCount = 2,
    conversation,
    previousResponseId,
    reasoning = policy.reasoning,
    text = policy.text,
    promptCacheKey = policy.promptCacheKey,
    store,
    metadata,
  } = options;

  // Map ChatCompletion-style messages to Responses API fields
  // - Aggregate system messages into a single `instructions` string
  // - Map user/assistant messages into structured `input` items
  const systemInstructions: string = messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => String(m.content))
    .join('\n');

  const nonSystem = messages.filter((m) => m.role !== 'system');

  // Check if any messages contain images
  const hasImages = nonSystem.some(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some(
        (part: unknown) =>
          typeof part === 'object' &&
          part !== null &&
          'type' in part &&
          part.type === 'image_url' &&
          'image_url' in part &&
          typeof part.image_url === 'object' &&
          part.image_url !== null &&
          'url' in part.image_url,
      ),
  );

  // If there are images, use Chat Completions API which has native vision support
  if (hasImages) {
    const chatCompletionMessages = messages.filter(
      (m) => m.role !== 'system',
    ) as OpenAI.Chat.ChatCompletionMessageParam[];

    const allMessages: Array<OpenAI.Chat.ChatCompletionMessageParam> = [];
    if (systemInstructions) {
      allMessages.push({ role: 'system', content: systemInstructions });
    }
    allMessages.push(...chatCompletionMessages);

    const visionPolicy = getOpenAiFlowPolicy('vision');
    // Use a vision-capable chat model. If caller passed a gpt-4* model, use it; otherwise use the vision policy.
    const visionModel =
      typeof model === 'string' && model.toLowerCase().startsWith('gpt-4')
        ? model
        : visionPolicy.model;

    let lastError: unknown = undefined;
    for (let attempt = 0; attempt <= retryCount; attempt++) {
      const startedAt = Date.now();
      try {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 30_000); // Reduced from 60s to 30s
        try {
          // Use Chat Completions API for vision
          const response = await openai.chat.completions.create(
            {
              model: visionModel,
              messages: allMessages,
              max_completion_tokens: maxCompletionTokens,
              temperature,
              frequency_penalty: frequencyPenalty,
              presence_penalty: presencePenalty,
            },
            { signal: controller.signal },
          );

          const content: string | null =
            response.choices[0]?.message?.content || null;

          // Log if we got an empty response
          if (!content || content.trim() === '') {
            console.warn(
              `[OpenAI] Vision API received empty content. Completion ID: ${response.id}`,
            );
          }

          try {
            const usage =
              (response?.usage as unknown as Record<string, unknown>) ?? {};
            const input = Number((usage.prompt_tokens as number) ?? 0);
            const output = Number((usage.completion_tokens as number) ?? 0);
            if (!Number.isNaN(input) && input > 0) {
              responsesInputTokens.inc({ model: visionModel }, input);
            }
            if (!Number.isNaN(output) && output > 0) {
              responsesOutputTokens.inc({ model: visionModel }, output);
            }
          } catch {
            // Ignore metric errors
          }
          recordOpenAiOutcome({
            model: visionModel,
            flow: 'vision',
            status: 'completed',
            startedAt,
          });
          // Chat Completions doesn't have conversation IDs, so we return undefined.
          // Context is maintained by passing message history.
          return { content, conversationId: undefined };
        } finally {
          clearTimeout(timeout);
        }
      } catch (error) {
        // Log the actual error details
        const errorMsg = error instanceof Error ? error.message : String(error);
        const errorName = error instanceof Error ? error.name : 'UnknownError';
        console.error(
          `[OpenAI] Vision API attempt ${attempt + 1}/${retryCount + 1} failed: ${errorName} - ${errorMsg}`,
        );

        try {
          openaiErrors.inc({ type: 'error' });
        } catch {
          // Ignore metric errors
        }
        try {
          interface ErrorWithStatus {
            status?: number;
            response?: { status?: number };
          }
          const errorWithStatus = error as ErrorWithStatus;
          const status =
            errorWithStatus?.status || errorWithStatus?.response?.status;
          if (status) {
            openaiHttpErrors.inc({ status: String(status) });
            console.error(`[OpenAI] Vision API HTTP Error status: ${status}`);
          }
        } catch {
          // Ignore metric errors
        }
        lastError = error;
        recordOpenAiOutcome({
          model: visionModel,
          flow: 'vision',
          status: getErrorStatus(error),
          startedAt,
        });

        // Don't retry if this is the last attempt
        if (attempt < retryCount) {
          const jitter = Math.random() * 100;
          const delayMs = 250 * Math.pow(2, attempt) + jitter;
          console.log(
            `[OpenAI] Vision API retrying in ${delayMs.toFixed(0)}ms...`,
          );
          await new Promise((r) => setTimeout(r, delayMs));
        }
      }
    }

    // Log final failure before throwing
    const finalErrorMsg =
      lastError instanceof Error ? lastError.message : String(lastError);
    console.error(
      `[OpenAI] Vision API all retry attempts exhausted. Final error: ${finalErrorMsg}`,
    );
    throw lastError;
  }

  const input = buildResponsesInput(nonSystem);
  const continuationResponseId = previousResponseId ?? conversation?.id;

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const startedAt = Date.now();
    try {
      const isGpt5: boolean =
        typeof model === 'string' && model.toLowerCase().startsWith('gpt-5');

      const payload: ResponseCreateParamsNonStreaming = {
        model,
        // Only include instructions if any system content exists
        ...(systemInstructions ? { instructions: systemInstructions } : {}),
        ...(input ? { input } : {}),
        // Prefer the Responses naming for token limits
        max_output_tokens: maxCompletionTokens,
        ...(continuationResponseId
          ? { previous_response_id: continuationResponseId }
          : {}),
        prompt_cache_key: promptCacheKey,
        ...(store === undefined ? {} : { store }),
        ...(metadata ? { metadata } : {}),
        ...(reasoning ? { reasoning } : {}),
        ...(text ? { text } : {}),
        ...(options.enableWebSearch
          ? {
              tool_choice: 'auto',
              tools: [{ type: 'web_search' }] satisfies Tool[],
            }
          : {}),
      };

      // Some models (e.g., gpt-5) ignore sampling parameters; match prior behavior
      if (!isGpt5) {
        Object.assign(payload, {
          temperature,
        });
      }

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000); // Reduced from 60s to 30s
      try {
        const response = await openai.responses.create(payload, {
          signal: controller.signal,
        });

        // Check for API error in response
        if (response?.error) {
          const error = response.error as unknown as Record<string, unknown>;
          const errorMsg =
            (error.message as string) || JSON.stringify(response.error);
          const errorType = (error.type as string) || 'unknown_error';
          console.error(
            `[OpenAI] API returned error in response: ${errorType} - ${errorMsg}`,
          );
          const apiError = new Error(
            `OpenAI API Error: ${errorType} - ${errorMsg}`,
          );
          setOpenAiStatus(apiError, errorType);
          throw apiError;
        }

        // Check response status
        if (response?.status && response.status !== 'completed') {
          console.warn(
            `[OpenAI] Response status is '${response.status}', not 'completed'. Treating as degraded response.`,
          );
          const errorMsg =
            response.incomplete_details?.reason ||
            response.error?.message ||
            'Response did not complete';
          const statusError = new Error(
            `OpenAI response ${response.status}: ${errorMsg}`,
          );
          setOpenAiStatus(statusError, response.status);
          throw statusError;
        }

        // Prefer `output_text` if populated; otherwise try to extract first text output
        const content: string | null =
          response?.output_text?.trim?.() ??
          extractFirstTextFromResponse(response);
        const convId: string | undefined =
          response?.conversation?.id ?? response?.id ?? undefined;

        // Log if we got an empty response
        if (!content || content.trim() === '') {
          console.warn(
            `[OpenAI] Received empty content. Response status: ${response?.status || 'unknown'}, Response keys: ${Object.keys(response).join(', ')}`,
          );
          // Log more details about the response structure
          if (response?.output) {
            console.warn(
              `[OpenAI] Output structure: ${JSON.stringify(response.output).substring(0, 500)}`,
            );
          }
        }

        try {
          const usage =
            (response?.usage as unknown as Record<string, unknown>) ?? {};
          const input = Number(
            (usage.input_tokens as number) ?? (usage.input as number) ?? 0,
          );
          const output = Number(
            (usage.output_tokens as number) ?? (usage.output as number) ?? 0,
          );
          recordOpenAiUsage(response.usage, model, flow);
          if (!Number.isNaN(input) && input > 0) {
            responsesInputTokens.inc({ model }, input);
          }
          if (!Number.isNaN(output) && output > 0) {
            responsesOutputTokens.inc({ model }, output);
          }
        } catch {
          // Ignore metric errors
        }
        recordOpenAiOutcome({
          model,
          flow,
          status: 'completed',
          startedAt,
        });
        return { content, conversationId: convId };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      // Log the actual error details
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error(
        `[OpenAI] Attempt ${attempt + 1}/${retryCount + 1} failed: ${errorName} - ${errorMsg}`,
      );

      try {
        openaiErrors.inc({ type: 'error' });
      } catch {
        // Ignore metric errors
      }
      try {
        interface ErrorWithStatus {
          status?: number;
          response?: { status?: number };
        }
        const errorWithStatus = error as ErrorWithStatus;
        const status =
          errorWithStatus?.status || errorWithStatus?.response?.status;
        if (status) {
          openaiHttpErrors.inc({ status: String(status) });
          console.error(`[OpenAI] HTTP Error status: ${status}`);
        }
      } catch {
        // Ignore metric errors
      }
      lastError = error;
      recordOpenAiOutcome({
        model,
        flow,
        status: getErrorStatus(error),
        startedAt,
      });

      // Don't retry if this is the last attempt
      if (attempt < retryCount) {
        const jitter = Math.random() * 100;
        const delayMs = 250 * Math.pow(2, attempt) + jitter;
        console.log(`[OpenAI] Retrying in ${delayMs.toFixed(0)}ms...`);
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  // Log final failure before throwing
  const finalErrorMsg =
    lastError instanceof Error ? lastError.message : String(lastError);
  console.error(
    `[OpenAI] All retry attempts exhausted. Final error: ${finalErrorMsg}`,
  );
  throw lastError;
}

export async function callStructuredResponse<TSchema extends z.ZodType>(
  messages: Array<OpenAI.Chat.ChatCompletionMessageParam>,
  schema: TSchema,
  schemaName: string,
  options: ChatRequestOptions = {},
): Promise<StructuredChatResponse<z.infer<TSchema>>> {
  const flow = options.flow ?? 'summary';
  const policy = getOpenAiFlowPolicy(flow);
  const {
    maxCompletionTokens = policy.maxCompletionTokens,
    model = policy.model,
    retryCount = 2,
    conversation,
    previousResponseId,
    reasoning = policy.reasoning,
    text = policy.text,
    promptCacheKey = policy.promptCacheKey,
    store,
    metadata,
  } = options;
  const systemInstructions: string = messages
    .filter((m) => m.role === 'system' && typeof m.content === 'string')
    .map((m) => String(m.content))
    .join('\n');
  const input = buildResponsesInput(
    messages.filter((m) => m.role !== 'system'),
  );
  const continuationResponseId = previousResponseId ?? conversation?.id;

  let lastError: unknown = undefined;
  for (let attempt = 0; attempt <= retryCount; attempt++) {
    const startedAt = Date.now();
    try {
      const payload: ResponseCreateParamsNonStreaming = {
        model,
        ...(systemInstructions ? { instructions: systemInstructions } : {}),
        ...(input ? { input } : {}),
        max_output_tokens: maxCompletionTokens,
        ...(continuationResponseId
          ? { previous_response_id: continuationResponseId }
          : {}),
        prompt_cache_key: promptCacheKey,
        ...(store === undefined ? {} : { store }),
        ...(metadata ? { metadata } : {}),
        ...(reasoning ? { reasoning } : {}),
        text: {
          ...(text ?? {}),
          format: zodTextFormat(schema, schemaName),
        },
      };

      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30_000);
      try {
        const response = await openai.responses.parse(payload, {
          signal: controller.signal,
        });

        if (response?.error) {
          const error = response.error as unknown as Record<string, unknown>;
          const errorMsg =
            (error.message as string) || JSON.stringify(response.error);
          const errorType = (error.type as string) || 'unknown_error';
          const apiError = new Error(
            `OpenAI API Error: ${errorType} - ${errorMsg}`,
          );
          setOpenAiStatus(apiError, errorType);
          throw apiError;
        }

        if (response?.status && response.status !== 'completed') {
          const errorMsg =
            response.incomplete_details?.reason ||
            response.error?.message ||
            'Response did not complete';
          const statusError = new Error(
            `OpenAI response ${response.status}: ${errorMsg}`,
          );
          setOpenAiStatus(statusError, response.status);
          throw statusError;
        }

        recordOpenAiUsage(response.usage, model, flow);
        recordOpenAiOutcome({
          model,
          flow,
          status: 'completed',
          startedAt,
        });

        const content: string | null =
          response?.output_text?.trim?.() ??
          extractFirstTextFromResponse(response);
        return {
          parsed: response.output_parsed ?? null,
          content,
          conversationId:
            response?.conversation?.id ?? response?.id ?? undefined,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorName = error instanceof Error ? error.name : 'UnknownError';
      console.error(
        `[OpenAI] Structured response attempt ${attempt + 1}/${retryCount + 1} failed: ${errorName} - ${errorMsg}`,
      );

      try {
        openaiErrors.inc({ type: 'error' });
      } catch {
        // Ignore metric errors
      }
      try {
        const status = getHttpStatus(error);
        if (status) {
          openaiHttpErrors.inc({ status: String(status) });
        }
      } catch {
        // Ignore metric errors
      }

      lastError = error;
      recordOpenAiOutcome({
        model,
        flow,
        status: getErrorStatus(error),
        startedAt,
      });

      if (attempt < retryCount) {
        const jitter = Math.random() * 100;
        const delayMs = 250 * Math.pow(2, attempt) + jitter;
        await new Promise((r) => setTimeout(r, delayMs));
      }
    }
  }

  throw lastError;
}

function buildResponsesInput(
  messages: Array<OpenAI.Chat.ChatCompletionMessageParam>,
): ResponseInput | undefined {
  const input = messages
    .map((message): EasyInputMessage | null => {
      const content = chatContentToText(message.content);
      if (!content) {
        return null;
      }

      return {
        role: message.role === 'assistant' ? 'assistant' : 'user',
        content,
      };
    })
    .filter((message): message is EasyInputMessage => message !== null);

  return input.length > 0 ? input : undefined;
}

function chatContentToText(
  content: OpenAI.Chat.ChatCompletionMessageParam['content'],
): string {
  if (typeof content === 'string') {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === 'string') {
          return part;
        }
        if (
          typeof part === 'object' &&
          part !== null &&
          'text' in part &&
          typeof part.text === 'string'
        ) {
          return part.text;
        }
        return '';
      })
      .filter((textPart) => textPart.length > 0)
      .join('\n');
  }

  return '';
}

function extractFirstTextFromResponse(res: unknown): string | null {
  try {
    if (!isObjectRecord(res)) {
      return null;
    }

    const outputText = res.output_text;
    if (outputText) {
      return typeof outputText === 'string'
        ? outputText.trim()
        : String(outputText);
    }

    // Fallback: walk typical Responses shapes to find first text segment
    const nestedResponse = isObjectRecord(res.response)
      ? res.response
      : undefined;
    const outputs = res.output ?? nestedResponse?.output ?? undefined;
    if (Array.isArray(outputs) && outputs.length > 0) {
      for (const item of outputs) {
        if (
          isObjectRecord(item) &&
          'content' in item &&
          Array.isArray(item.content)
        ) {
          for (const part of item.content) {
            if (
              isObjectRecord(part) &&
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

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function recordOpenAiUsage(
  usage: ResponseUsage | null | undefined,
  model: string,
  flow: OpenAiFlow,
): void {
  if (!usage) return;

  const cachedTokens = usage.input_tokens_details?.cached_tokens ?? 0;
  const reasoningTokens = usage.output_tokens_details?.reasoning_tokens ?? 0;

  if (cachedTokens > 0) {
    responsesCachedInputTokens.inc({ model, flow }, cachedTokens);
  }
  if (reasoningTokens > 0) {
    responsesReasoningOutputTokens.inc({ model, flow }, reasoningTokens);
  }
}

function recordOpenAiOutcome({
  model,
  flow,
  status,
  startedAt,
}: {
  model: string;
  flow: OpenAiFlow;
  status: string;
  startedAt: number;
}): void {
  try {
    openaiResponseStatus.inc({ model, flow, status });
    openaiResponseLatency.observe(
      { model, flow, status },
      Date.now() - startedAt,
    );
  } catch {
    // Ignore metric errors
  }
}

function getHttpStatus(error: unknown): number | undefined {
  interface ErrorWithStatus {
    status?: number;
    response?: { status?: number };
  }
  const errorWithStatus = error as ErrorWithStatus;
  return errorWithStatus?.status || errorWithStatus?.response?.status;
}

function getErrorStatus(error: unknown): string {
  const openAiStatus = isObjectRecord(error) ? error.openAiStatus : undefined;
  if (typeof openAiStatus === 'string' && openAiStatus.length > 0) {
    return openAiStatus;
  }
  const httpStatus = getHttpStatus(error);
  if (httpStatus) {
    return String(httpStatus);
  }
  if (error instanceof Error && error.name) {
    return error.name;
  }
  return 'error';
}

function setOpenAiStatus(error: Error, status: string): void {
  Object.defineProperty(error, 'openAiStatus', {
    value: status,
    enumerable: false,
  });
}
