import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './core/config/config.module';
import { MetricsModule } from './core/metrics/metrics.module';
import { DiscordModule } from './discord/discord.module';
import { ServersModule } from './servers/servers.module';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    AppConfigModule,
    UsersModule,
    ServersModule,
    // Configure Mongoose using ConfigService to support MONGO_URI or legacy user/pw
    MongooseModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const uriFromEnv = config.get<string>('MONGO_URI');
        const user = config.get<string>('MONGO_USER');
        const pw = config.get<string>('MONGO_PW');
        const legacyUri =
          user && pw
            ? `mongodb+srv://${user}:${pw}@maincluster.uax2tb8.mongodb.net/`
            : undefined;
        const uri = uriFromEnv ?? legacyUri;
        if (!uri) {
          throw new Error('MONGO_URI or MONGO_USER/MONGO_PW must be set');
        }
        return {
          uri,
        };
      },
    }),
    ScheduleModule.forRoot(),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 120,
      },
    ]),
    TasksModule,
    DiscordModule,
    MetricsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: 'APP_GUARD',
      useClass: ThrottlerGuard,
    },
  ],
})
export class AppModule {}
