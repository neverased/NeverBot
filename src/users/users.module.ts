import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { User, UserSchema } from './schemas/users.schema';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UserMessagesModule } from './messages/messages.module';
import { UserSummaryUpdateService } from './user-summary-update.service';

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
