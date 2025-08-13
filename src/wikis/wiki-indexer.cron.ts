import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { WikiScraperService } from './wikiscraper.service';

@Injectable()
export class WikiIndexerCron {
  private readonly logger = new Logger(WikiIndexerCron.name);

  constructor(private readonly scraper: WikiScraperService) {}

  @Cron(process.env.WIKI_INDEX_CRON || '0 3 * * 0')
  async handleWeeklyIndex(): Promise<void> {
    if (String(process.env.WIKI_INDEX_CRON_ENABLED).toLowerCase() !== 'true') {
      return;
    }
    const baseUrl =
      process.env.WIKI_INDEX_BASE_URL ||
      'https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki';
    const maxPages = Number(process.env.WIKI_INDEX_MAX_PAGES || 1000);
    const concurrency = Number(process.env.WIKI_INDEX_CONCURRENCY || 4);
    this.logger.log(
      `Starting scheduled wiki index: baseUrl=${baseUrl}, maxPages=${maxPages}, concurrency=${concurrency}`,
    );
    try {
      const count = await this.scraper.crawlAndIndex({
        baseUrl,
        maxPages,
        concurrency,
      });
      this.logger.log(`Scheduled wiki index complete. Indexed: ${count}`);
    } catch (err) {
      this.logger.error('Scheduled wiki index failed', err as Error);
    }
  }
}
