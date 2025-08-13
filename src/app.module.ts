import 'dotenv/config';

import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ScheduleModule } from '@nestjs/schedule';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { DiscordService } from './discord/discord.service';
import { TasksModule } from './tasks/tasks.module';
import { UsersModule } from './users/users.module';
import { ServersModule } from './servers/servers.module';
import { AppConfigModule } from './core/config/config.module';
import { WikisModule } from './wikis/wikis.module';

@Module({
  imports: [
    AppConfigModule,
    UsersModule,
    ServersModule,
    MongooseModule.forRoot(
      `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PW}@maincluster.uax2tb8.mongodb.net/`,
    ),
    ScheduleModule.forRoot(),
    TasksModule,
    WikisModule,
  ],
  controllers: [AppController],
  providers: [AppService, DiscordService],
})
export class AppModule {}
