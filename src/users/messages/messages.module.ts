import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserMessagesService } from './messages.service';
import { UserMessage, UserMessageSchema } from './schemas/user-message.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: UserMessage.name, schema: UserMessageSchema },
    ]),
  ],
  providers: [UserMessagesService],
  exports: [UserMessagesService],
})
export class UserMessagesModule {}
