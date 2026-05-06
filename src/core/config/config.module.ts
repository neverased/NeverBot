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
        METRICS_HIGH_CARD: Joi.boolean().default(false),
        WEB_SEARCH_ENABLED: Joi.boolean().default(false),
        LLM_MODEL_DEFAULT: Joi.string().optional(),
        LLM_MODEL_CHAT: Joi.string().optional(),
        LLM_MODEL_SUMMARY: Joi.string().optional(),
        LLM_MODEL_CHANGELOG: Joi.string().optional(),
        LLM_MODEL_VISION: Joi.string().optional(),
        LLM_MODEL_IMAGE: Joi.string().optional(),
        LLM_REASONING_CHAT: Joi.string()
          .valid('none', 'minimal', 'low', 'medium', 'high', 'xhigh')
          .optional(),
        LLM_REASONING_SUMMARY: Joi.string()
          .valid('none', 'minimal', 'low', 'medium', 'high', 'xhigh')
          .optional(),
        LLM_REASONING_CHANGELOG: Joi.string()
          .valid('none', 'minimal', 'low', 'medium', 'high', 'xhigh')
          .optional(),
        LLM_MAX_OUTPUT_TOKENS_CHAT: Joi.number().integer().min(1).optional(),
        LLM_MAX_OUTPUT_TOKENS_SUMMARY: Joi.number().integer().min(1).optional(),
        LLM_MAX_OUTPUT_TOKENS_CHANGELOG: Joi.number()
          .integer()
          .min(1)
          .optional(),
        LLM_MAX_OUTPUT_TOKENS_VISION: Joi.number().integer().min(1).optional(),
        LLM_PROMPT_CACHE_KEY_PREFIX: Joi.string().optional(),
        ALLOWED_ORIGINS: Joi.string().optional(),
        PORT: Joi.number().integer().min(1).max(65535).default(3500),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .optional(),
      }),
    }),
  ],
})
export class AppConfigModule {}
