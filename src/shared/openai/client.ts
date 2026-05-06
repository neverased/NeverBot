import 'dotenv/config';

import OpenAI from 'openai';

let client: OpenAI | undefined;

function getOpenAiApiKey(): string {
  const apiKey = process.env.GPT_KEY ?? process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error(
      'GPT_KEY or OPENAI_API_KEY environment variable is not set.',
    );
  }
  return apiKey;
}

function getOpenAiClient(): OpenAI {
  client ??= new OpenAI({
    apiKey: getOpenAiApiKey(),
  });
  return client;
}

const openai = new Proxy({} as OpenAI, {
  get(_target, prop, receiver) {
    return Reflect.get(getOpenAiClient(), prop, receiver);
  },
});

export default openai;
