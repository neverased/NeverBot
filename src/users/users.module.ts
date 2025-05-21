import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserMessagesModule } from './messages/messages.module';
import { User, UserSchema } from './schemas/users.schema';
import { UserSummaryUpdateService } from './user-summary-update.service';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UserMessagesModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, UserSummaryUpdateService],
  exports: [UsersService, UserMessagesModule, UserSummaryUpdateService],
})
export class UsersModule {}
