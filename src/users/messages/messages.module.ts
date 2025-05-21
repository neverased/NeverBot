import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserMessagesController } from './messages.controller';
import { UserMessagesService } from './messages.service';
import { UserMessage, UserMessageSchema } from './schemas/user-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserMessage.name, schema: UserMessageSchema },
    ]),
  ],
  controllers: [UserMessagesController],
  providers: [UserMessagesService],
  exports: [UserMessagesService],
})
export class UserMessagesModule {}
