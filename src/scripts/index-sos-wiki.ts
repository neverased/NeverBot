import 'dotenv/config';

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WikiScraperService } from '../wikis/wikiscraper.service';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: ['log', 'error', 'warn'],
  });
  const scraper = app.get(WikiScraperService);
  const baseUrl =
    'https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki';
  const count = await scraper.crawlAndIndex({
    baseUrl,
    maxPages: 3000,
    concurrency: 4,
  });
  // eslint-disable-next-line no-console
  console.log(`Indexed ${count} pages.`);
  await app.close();
}

bootstrap().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
