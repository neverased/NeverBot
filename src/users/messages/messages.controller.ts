import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
} from '@nestjs/common';
import { mongo } from 'mongoose';

import {
  CreateUserMessageDto,
  UpdateUserMessageDto,
} from './dto/create-user-message.dto';
import { UserMessagesService } from './messages.service';

@Controller('users/:userId/messages')
export class UserMessagesController {
  constructor(private readonly userMessagesService: UserMessagesService) {}

  @Post()
  create(
    @Param('userId') userId: string,
    @Body() createUserMessageDto: CreateUserMessageDto,
  ) {
    return this.userMessagesService.create({ ...createUserMessageDto, userId });
  }

  @Get()
  findAll(@Param('userId') userId: string) {
    return this.userMessagesService.findAllByUserId(userId);
  }

  @Get(':messageId')
  findOne(
    @Param('userId') userId: string,
    @Param('messageId') messageId: string,
  ) {
    return this.userMessagesService.findOne(userId, messageId);
  }

  @Patch(':messageId')
  update(
    @Param('userId') userId: string,
    @Param('messageId') messageId: string,
    @Body() updateUserMessageDto: UpdateUserMessageDto,
  ) {
    return this.userMessagesService.update(
      userId,
      messageId,
      updateUserMessageDto,
    );
  }

  @Delete(':messageId')
  remove(
    @Param('userId') userId: string,
    @Param('messageId') messageId: string,
  ): Promise<mongo.DeleteResult> {
    return this.userMessagesService.remove(userId, messageId);
  }
}
