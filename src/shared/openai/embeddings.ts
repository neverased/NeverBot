import 'dotenv/config';

import OpenAI from 'openai';

const client = new OpenAI({ apiKey: process.env.GPT_KEY });

export interface EmbeddingResult {
  vector: number[];
}

/**
 * Create an embedding vector for the provided text using OpenAI.
 */
export async function createEmbedding(text: string): Promise<EmbeddingResult> {
  const input = text.length > 8000 ? text.slice(0, 8000) : text;
  const response = await client.embeddings.create({
    model: 'text-embedding-3-large',
    input,
  });
  const vector = response.data[0]?.embedding ?? [];
  return { vector };
}
