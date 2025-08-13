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
        MONGO_USER: Joi.string().required(),
        MONGO_PW: Joi.string().required(),
        API_URL: Joi.string().uri().optional(),
        GOOGLE_CLOUD_CREDENTIALS_PATH: Joi.string().optional(),
        NODE_ENV: Joi.string()
          .valid('development', 'test', 'production')
          .optional(),
      }),
    }),
  ],
})
export class AppConfigModule {}
