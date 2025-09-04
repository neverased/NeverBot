import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WikiChunk } from './schemas/wiki-chunk.schema';
import { createEmbedding } from '../shared/openai/embeddings';

interface SearchResult {
  url: string;
  title: string;
  content: string;
  score: number;
}

@Injectable()
export class WikiSearchService {
  constructor(
    @InjectModel(WikiChunk.name) private readonly chunkModel: Model<WikiChunk>,
  ) {}

  async searchRelevantChunks(
    query: string,
    limit: number = 5,
  ): Promise<SearchResult[]> {
    // eslint-disable-next-line no-console
    console.log(`[RAG] Searching wiki for: ${query}`);
    const { vector } = await createEmbedding(query);
    // Naive similarity in MongoDB: fetch candidate subset, then compute cosine similarity in app
    const candidateLimit = Number(process.env.WIKI_SEARCH_CANDIDATES || 500);
    const candidates = await this.chunkModel
      .find()
      .limit(candidateLimit)
      .lean();
    const withScore = candidates.map((c) => ({
      url: c.url,
      title: c.title,
      content: c.content,
      score: this.computeCosineSimilarity(
        vector,
        (c.embedding ?? []) as number[],
      ),
    }));
    withScore.sort((a, b) => b.score - a.score);
    const top = withScore.slice(0, limit);
    // eslint-disable-next-line no-console
    console.log(
      `[RAG] Top results: ${top
        .map((t, i) => `#${i + 1} ${t.title} (score=${t.score.toFixed(3)})`)
        .join(' | ')}`,
    );
    return top;
  }

  private computeCosineSimilarity(a: number[], b: number[]): number {
    if (a.length === 0 || b.length === 0) return 0;
    const minLen = Math.min(a.length, b.length);
    let dot = 0;
    let normA = 0;
    let normB = 0;
    for (let i = 0; i < minLen; i++) {
      dot += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }
    if (normA === 0 || normB === 0) return 0;
    return dot / (Math.sqrt(normA) * Math.sqrt(normB));
  }
}
