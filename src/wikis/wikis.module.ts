import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WikiPage, WikiPageSchema } from './schemas/wiki-page.schema';
import { WikiChunk, WikiChunkSchema } from './schemas/wiki-chunk.schema';
import { WikiScraperService } from './wikiscraper.service';
import { WikiSearchService } from './wikisearch.service';
import { WikiIndexerCron } from './wiki-indexer.cron';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WikiPage.name, schema: WikiPageSchema },
      { name: WikiChunk.name, schema: WikiChunkSchema },
    ]),
  ],
  providers: [WikiScraperService, WikiSearchService, WikiIndexerCron],
  exports: [WikiScraperService, WikiSearchService],
})
export class WikisModule {}
