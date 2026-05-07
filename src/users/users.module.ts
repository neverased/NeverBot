import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';

import { UserMessagesModule } from './messages/messages.module';
import { PersonalityService } from './personality/personality.service';
import { User, UserSchema } from './schemas/users.schema';
import { UsersService } from './users.service';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    UserMessagesModule,
  ],
  providers: [UsersService, PersonalityService],
  exports: [UsersService, UserMessagesModule, PersonalityService],
})
export class UsersModule {}
