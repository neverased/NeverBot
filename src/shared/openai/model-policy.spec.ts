import { getOpenAiFlowPolicy } from './model-policy';

describe('OpenAI model policy prompt cache keys', () => {
  const originalPrefix = process.env.LLM_PROMPT_CACHE_KEY_PREFIX;

  beforeEach(() => {
    process.env.LLM_PROMPT_CACHE_KEY_PREFIX = 'testbot';
  });

  afterEach(() => {
    if (originalPrefix === undefined) {
      delete process.env.LLM_PROMPT_CACHE_KEY_PREFIX;
    } else {
      process.env.LLM_PROMPT_CACHE_KEY_PREFIX = originalPrefix;
    }
  });

  it('versions cache keys per flow so changed prompt prefixes can roll independently', () => {
    expect(getOpenAiFlowPolicy('chat').promptCacheKey).toBe('testbot:chat:v2');
    expect(getOpenAiFlowPolicy('changelog').promptCacheKey).toBe(
      'testbot:changelog:v2',
    );
    expect(getOpenAiFlowPolicy('summary').promptCacheKey).toBe(
      'testbot:summary:v1',
    );
    expect(getOpenAiFlowPolicy('personality').promptCacheKey).toBe(
      'testbot:personality:v1',
    );
  });
});
