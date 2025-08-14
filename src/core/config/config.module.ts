import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import * as Joi from 'joi';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: Joi.object({
        BOT_TOKEN: Joi.string().required(),
        GPT_KEY: Joi.string().required(),
        // New preferred connection string; keep legacy user/pw optional for fallback
        MONGO_URI: Joi.string().uri().optional(),
        MONGO_USER: Joi.string().optional(),
        MONGO_PW: Joi.string().optional(),
        DISCORD_APPLICATION_ID: Joi.string().optional(),
        API_URL: Joi.string().uri().optional(),
        GOOGLE_CLOUD_CREDENTIALS_PATH: Joi.string().optional(),
        RAG_CITE_SOURCES: Joi.boolean().default(false),
        WIKI_INDEX_CRON_ENABLED: Joi.boolean().default(false),
        WIKI_INDEX_CRON: Joi.string()
          .default('0 3 * * 0') // Sunday 03:00
          .optional(),
        WIKI_INDEX_BASE_URL: Joi.string()
          .uri()
          .default(
            'https://state-of-survival.fandom.com/wiki/State_of_Survival_Wiki',
          )
          .optional(),
        WIKI_INDEX_MAX_PAGES: Joi.number().integer().min(1).default(1000),
        WIKI_INDEX_CONCURRENCY: Joi.number().integer().min(1).default(4),
        METRICS_HIGH_CARD: Joi.boolean().default(false),
        PORT: Joi.number().integer().min(1).max(65535).default(3500),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .optional(),
      }),
    }),
  ],
})
export class AppConfigModule {}
