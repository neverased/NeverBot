import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserMessagesModule } from './messages/messages.module';
import { User, UserSchema } from './schemas/users.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UserMessagesModule,
  ],
  providers: [UsersService],
  exports: [UsersService, UserMessagesModule],
})
export class UsersModule {}
