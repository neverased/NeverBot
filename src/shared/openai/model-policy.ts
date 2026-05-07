export type OpenAiFlow = 'chat' | 'summary' | 'changelog' | 'vision' | 'image';

export type ReasoningEffort =
  | 'none'
  | 'minimal'
  | 'low'
  | 'medium'
  | 'high'
  | 'xhigh';

export interface OpenAiFlowPolicy {
  model: string;
  maxCompletionTokens: number;
  reasoning?: { effort: ReasoningEffort };
  text?: { verbosity: 'low' | 'medium' | 'high' };
  promptCacheKey: string;
}

const DEFAULT_POLICIES: Record<OpenAiFlow, OpenAiFlowPolicy> = {
  chat: {
    model: 'gpt-5.5',
    maxCompletionTokens: 768,
    reasoning: { effort: 'low' },
    text: { verbosity: 'low' },
    promptCacheKey: 'neverbot:chat:v2',
  },
  summary: {
    model: 'gpt-5.5',
    maxCompletionTokens: 320,
    reasoning: { effort: 'low' },
    text: { verbosity: 'low' },
    promptCacheKey: 'neverbot:summary:v1',
  },
  changelog: {
    model: 'gpt-5.5',
    maxCompletionTokens: 1200,
    reasoning: { effort: 'medium' },
    text: { verbosity: 'medium' },
    promptCacheKey: 'neverbot:changelog:v2',
  },
  vision: {
    model: 'gpt-4o',
    maxCompletionTokens: 768,
    promptCacheKey: 'neverbot:vision:v1',
  },
  image: {
    model: 'gpt-image-1',
    maxCompletionTokens: 0,
    promptCacheKey: 'neverbot:image:v1',
  },
};

const REASONING_VALUES = new Set<ReasoningEffort>([
  'none',
  'minimal',
  'low',
  'medium',
  'high',
  'xhigh',
]);

export function getOpenAiFlowPolicy(flow: OpenAiFlow): OpenAiFlowPolicy {
  const defaults = DEFAULT_POLICIES[flow];
  const envSuffix = flow.toUpperCase();
  const model =
    getEnv(`LLM_MODEL_${envSuffix}`) ??
    getEnv('LLM_MODEL_DEFAULT') ??
    defaults.model;
  const maxCompletionTokens =
    getPositiveIntEnv(`LLM_MAX_OUTPUT_TOKENS_${envSuffix}`) ??
    defaults.maxCompletionTokens;
  const reasoning = getReasoningEffortEnv(`LLM_REASONING_${envSuffix}`);
  const promptCacheKeyPrefix =
    getEnv('LLM_PROMPT_CACHE_KEY_PREFIX') ?? 'neverbot';
  const promptCacheKeyVersion = getPromptCacheKeyVersion(
    defaults.promptCacheKey,
  );

  return {
    ...defaults,
    model,
    maxCompletionTokens,
    ...(reasoning ? { reasoning: { effort: reasoning } } : {}),
    promptCacheKey: `${promptCacheKeyPrefix}:${flow}:${promptCacheKeyVersion}`,
  };
}

function getEnv(name: string): string | undefined {
  const value = process.env[name]?.trim();
  return value ? value : undefined;
}

function getPositiveIntEnv(name: string): number | undefined {
  const raw = getEnv(name);
  if (!raw) return undefined;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
}

function getReasoningEffortEnv(name: string): ReasoningEffort | undefined {
  const raw = getEnv(name);
  if (!raw) return undefined;
  if (!REASONING_VALUES.has(raw as ReasoningEffort)) {
    return undefined;
  }
  return raw as ReasoningEffort;
}

function getPromptCacheKeyVersion(defaultPromptCacheKey: string): string {
  const keyParts = defaultPromptCacheKey.split(':');
  return keyParts[keyParts.length - 1] || 'v1';
}
