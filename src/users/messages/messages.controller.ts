import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UserMessagesService } from './messages.service';
import {
  CreateUserMessageDto,
  UpdateUserMessageDto,
} from './dto/create-user-message.dto';

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
  ) {
    return this.userMessagesService.remove(userId, messageId);
  }
}
