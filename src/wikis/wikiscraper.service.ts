import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';
import pLimit from 'p-limit';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WikiPage } from './schemas/wiki-page.schema';
import { WikiChunk } from './schemas/wiki-chunk.schema';
import { createEmbedding } from '../shared/openai/embeddings';

interface CrawlOptions {
  baseUrl: string;
  maxPages?: number;
  concurrency?: number;
}

@Injectable()
export class WikiScraperService {
  private readonly logger = new Logger(WikiScraperService.name);

  constructor(
    @InjectModel(WikiPage.name) private readonly pageModel: Model<WikiPage>,
    @InjectModel(WikiChunk.name) private readonly chunkModel: Model<WikiChunk>,
  ) {}

  async crawlAndIndex(options: CrawlOptions): Promise<number> {
    const { baseUrl, maxPages = 500, concurrency = 4 } = options;
    const visited = new Set<string>();
    const queue: string[] = [baseUrl];
    const limit = pLimit(concurrency);
    let processed = 0;
    this.logger.log(
      `Starting crawl from ${baseUrl} (maxPages=${maxPages}, concurrency=${concurrency})`,
    );

    while (queue.length > 0 && processed < maxPages) {
      const batch = queue.splice(0, concurrency);
      await Promise.all(
        batch.map((url) =>
          limit(async () => {
            if (visited.has(url) || !this.isSameWiki(url, baseUrl)) return;
            visited.add(url);
            try {
              this.logger.debug(`Fetching: ${url}`);
              const html = await this.fetchHtml(url);
              const { title, content, links, headings } = this.parseHtml(
                url,
                html,
              );
              this.logger.debug(
                `Parsed: ${title || '(untitled)'} with ${links.length} links`,
              );
              await this.savePage(url, title, content, headings);
              links.forEach((link) => {
                if (!visited.has(link) && this.isSameWiki(link, baseUrl)) {
                  queue.push(link);
                }
              });
              processed += 1;
              if (processed % 25 === 0) {
                this.logger.log(`Progress: ${processed} pages indexed...`);
              }
            } catch (err) {
              this.logger.warn(
                `Failed to crawl ${url}: ${(err as Error).message}`,
              );
            }
          }),
        ),
      );
    }
    this.logger.log(`Crawl finished. Indexed pages: ${processed}`);
    return processed;
  }

  private isSameWiki(url: string, baseUrl: string): boolean {
    try {
      const u = new URL(url, baseUrl);
      const b = new URL(baseUrl);
      return u.host === b.host && u.pathname.startsWith('/wiki/');
    } catch {
      return false;
    }
  }

  private async fetchHtml(url: string): Promise<string> {
    const response = await axios.get(url, { timeout: 20000 });
    return response.data as string;
  }

  private parseHtml(
    url: string,
    html: string,
  ): {
    title: string;
    content: string;
    headings: string[];
    links: string[];
  } {
    const $ = cheerio.load(html);
    const title =
      $('h1#firstHeading').text().trim() || $('title').text().trim();
    const article = $('#mw-content-text');
    // Remove navboxes, tables, refs, edit links
    article
      .find('.navbox, .toc, .reference, .mw-editsection, script, style')
      .remove();
    const headings: string[] = article
      .find('h2, h3, h4')
      .map((_, el) => $(el).text().trim())
      .get();
    const paragraphs: string[] = article
      .find('p, li')
      .map((_, el) => $(el).text().trim())
      .get();
    const content = paragraphs.filter(Boolean).join('\n');
    const links = article
      .find('a[href^="/wiki/"]')
      .map((_, el) => new URL($(el).attr('href')!, url).toString())
      .get();
    return { title, content, links, headings };
  }

  private chunkText(
    text: string,
    chunkSize: number = 1200,
    overlap: number = 150,
  ): string[] {
    const chunks: string[] = [];
    let start = 0;
    while (start < text.length) {
      const end = Math.min(start + chunkSize, text.length);
      const slice = text.slice(start, end);
      chunks.push(slice);
      if (end === text.length) break;
      start = end - overlap;
      if (start < 0) start = 0;
    }
    return chunks;
  }

  private async savePage(
    url: string,
    title: string,
    content: string,
    headings: string[],
  ): Promise<void> {
    if (!title || !content) return;
    this.logger.debug(`Upserting page: ${title} (${url})`);
    const page = await this.pageModel.findOneAndUpdate(
      { url },
      { title, content, headings, lastCrawledAt: new Date() },
      { upsert: true, new: true },
    );
    // Remove old chunks
    await this.chunkModel.deleteMany({ pageId: page._id });
    // Create new chunks with embeddings
    const pieces = this.chunkText(content);
    this.logger.debug(`Chunking page into ${pieces.length} chunks`);
    for (let i = 0; i < pieces.length; i++) {
      const piece = pieces[i];
      const { vector } = await createEmbedding(piece);
      await this.chunkModel.create({
        pageId: page._id.toString(),
        url,
        title,
        content: piece,
        embedding: vector,
        order: i,
      });
    }
  }
}
