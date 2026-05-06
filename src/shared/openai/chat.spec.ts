import OpenAI from 'openai';
import { z } from 'zod';

import { callChatCompletion, callStructuredResponse } from './chat';
import openai from './client';

jest.mock('./client', () => ({
  __esModule: true,
  default: {
    responses: {
      create: jest.fn(),
      parse: jest.fn(),
    },
    chat: {
      completions: {
        create: jest.fn(),
      },
    },
  },
}));

jest.mock('../../core/metrics/metrics-registry', () => ({
  openaiResponseLatency: { observe: jest.fn() },
  openaiResponseStatus: { inc: jest.fn() },
  openaiErrors: { inc: jest.fn() },
  openaiHttpErrors: { inc: jest.fn() },
  responsesCachedInputTokens: { inc: jest.fn() },
  responsesInputTokens: { inc: jest.fn() },
  responsesOutputTokens: { inc: jest.fn() },
  responsesReasoningOutputTokens: { inc: jest.fn() },
}));

const mockedOpenAI = openai as unknown as {
  responses: { create: jest.Mock; parse: jest.Mock };
  chat: { completions: { create: jest.Mock } };
};

describe('callChatCompletion', () => {
  const originalWebSearchEnabled = process.env.WEB_SEARCH_ENABLED;
  let consoleWarnSpy: jest.SpyInstance;
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.WEB_SEARCH_ENABLED;
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
    consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();

    mockedOpenAI.responses.create.mockResolvedValue({
      id: 'resp_123',
      status: 'completed',
      output_text: 'ok',
      output: [],
      error: null,
      incomplete_details: null,
      usage: { input_tokens: 10, output_tokens: 2 },
    });
    mockedOpenAI.responses.parse.mockResolvedValue({
      id: 'resp_structured',
      status: 'completed',
      output_text: '{"summary":"ok"}',
      output: [],
      output_parsed: { summary: 'ok' },
      error: null,
      incomplete_details: null,
      usage: {
        input_tokens: 10,
        output_tokens: 2,
        input_tokens_details: { cached_tokens: 3 },
        output_tokens_details: { reasoning_tokens: 1 },
      },
    });
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });

  afterAll(() => {
    if (originalWebSearchEnabled === undefined) {
      delete process.env.WEB_SEARCH_ENABLED;
    } else {
      process.env.WEB_SEARCH_ENABLED = originalWebSearchEnabled;
    }
  });

  it('sends text-only messages as role-preserving Responses input items', async () => {
    await callChatCompletion(
      [
        { role: 'system', content: 'stay brief' },
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'next' },
      ],
      {
        retryCount: 0,
        conversation: { id: 'resp_previous' },
      },
    );

    const payload = mockedOpenAI.responses.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      instructions: 'stay brief',
      previous_response_id: 'resp_previous',
      input: [
        { role: 'user', content: 'hello' },
        { role: 'assistant', content: 'hi' },
        { role: 'user', content: 'next' },
      ],
    });
    expect(payload).not.toHaveProperty('conversation');
    expect(JSON.stringify(payload.input)).not.toContain('User:');
    expect(JSON.stringify(payload.input)).not.toContain('Assistant:');
  });

  it('throws instead of returning content from incomplete Responses', async () => {
    mockedOpenAI.responses.create.mockResolvedValueOnce({
      id: 'resp_incomplete',
      status: 'incomplete',
      output_text: 'partial content',
      output: [],
      error: null,
      incomplete_details: { reason: 'max_output_tokens' },
      usage: { input_tokens: 10, output_tokens: 2 },
    });

    await expect(
      callChatCompletion([{ role: 'user', content: 'summarize' }], {
        retryCount: 0,
      }),
    ).rejects.toThrow('OpenAI response incomplete: max_output_tokens');
  });

  it('only enables web search when the call opts in', async () => {
    process.env.WEB_SEARCH_ENABLED = 'true';

    await callChatCompletion([{ role: 'user', content: 'hello' }], {
      retryCount: 0,
    });

    const payloadWithoutOptIn = mockedOpenAI.responses.create.mock.calls[0][0];
    expect(payloadWithoutOptIn).not.toHaveProperty('tools');
    expect(payloadWithoutOptIn).not.toHaveProperty('tool_choice');

    await callChatCompletion([{ role: 'user', content: 'latest news?' }], {
      retryCount: 0,
      enableWebSearch: true,
    });

    const payloadWithOptIn = mockedOpenAI.responses.create.mock.calls[1][0];
    expect(payloadWithOptIn).toMatchObject({
      tool_choice: 'auto',
      tools: [{ type: 'web_search' }],
    });
  });

  it('uses max_completion_tokens for vision Chat Completions', async () => {
    mockedOpenAI.chat.completions.create.mockResolvedValueOnce({
      id: 'chatcmpl_123',
      choices: [{ message: { content: 'roasted' } }],
      usage: { prompt_tokens: 12, completion_tokens: 3 },
    });

    const visionMessage: OpenAI.Chat.ChatCompletionMessageParam = {
      role: 'user',
      content: [
        { type: 'text', text: 'roast this' },
        {
          type: 'image_url',
          image_url: { url: 'https://example.com/image.png' },
        },
      ],
    };

    await callChatCompletion([visionMessage], { retryCount: 0 });

    const payload = mockedOpenAI.chat.completions.create.mock.calls[0][0];
    expect(payload).toMatchObject({
      max_completion_tokens: 768,
    });
    expect(payload).not.toHaveProperty('max_tokens');
  });

  it('parses structured Responses with a schema and prompt cache key', async () => {
    const schema = z.object({ summary: z.string() });

    const response = await callStructuredResponse(
      [{ role: 'user', content: 'summarize this' }],
      schema,
      'summary_payload',
      { retryCount: 0, flow: 'summary' },
    );

    expect(response.parsed).toEqual({ summary: 'ok' });
    const payload = mockedOpenAI.responses.parse.mock.calls[0][0];
    expect(payload).toMatchObject({
      model: 'gpt-5.5',
      prompt_cache_key: 'neverbot:summary:v1',
      text: {
        verbosity: 'low',
        format: expect.objectContaining({
          type: 'json_schema',
        }),
      },
    });
  });
});
