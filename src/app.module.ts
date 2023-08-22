import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { MongooseModule } from '@nestjs/mongoose';
import 'dotenv/config';
import { DiscordService } from './discord/discord.service';
@Module({
  imports: [
    UsersModule,
    MongooseModule.forRoot(
      `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PW}@maincluster.uax2tb8.mongodb.net/`,
    ),
  ],
  controllers: [AppController],
  providers: [AppService, DiscordService],
})
export class AppModule {}
