import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CreateUserMessageDto,
  UpdateUserMessageDto,
} from './dto/create-user-message.dto';
import {
  UserMessage,
  UserMessageDocument,
} from './schemas/user-message.schema';

@Injectable()
export class UserMessagesService {
  private readonly logger = new Logger(UserMessagesService.name);

  constructor(
    @InjectModel(UserMessage.name)
    private userMessageModel: Model<UserMessageDocument>,
  ) {}

  async create(
    createUserMessageDto: CreateUserMessageDto,
  ): Promise<UserMessage> {
    this.logger.log(
      `Creating message for userId: ${createUserMessageDto.userId}, messageId: ${createUserMessageDto.messageId}`,
    );
    try {
      const createdUserMessage = new this.userMessageModel(
        createUserMessageDto,
      );
      const savedMessage = await createdUserMessage.save();
      this.logger.log(
        `Successfully saved message for userId: ${createUserMessageDto.userId}, messageId: ${createUserMessageDto.messageId}`,
      );
      return savedMessage;
    } catch (error) {
      this.logger.error(
        `Error saving message for userId: ${createUserMessageDto.userId}, messageId: ${createUserMessageDto.messageId}: ${error.message}`,
        error.stack,
      );
      throw error;
    }
  }

  async findAllByUserId(userId: string): Promise<UserMessage[]> {
    return this.userMessageModel.find({ userId }).exec();
  }

  async findOne(userId: string, messageId: string): Promise<UserMessage> {
    return this.userMessageModel.findOne({ userId, messageId }).exec();
  }

  async update(
    userId: string,
    messageId: string,
    updateUserMessageDto: UpdateUserMessageDto,
  ): Promise<UserMessage> {
    return this.userMessageModel
      .findOneAndUpdate({ userId, messageId }, updateUserMessageDto, {
        new: true,
      })
      .exec();
  }

  async remove(userId: string, messageId: string): Promise<any> {
    return this.userMessageModel.deleteOne({ userId, messageId }).exec();
  }

  async findMessagesForPersonalityAnalysis(
    userId: string,
    limit: number = 100,
  ): Promise<UserMessage[]> {
    return this.userMessageModel
      .find({ userId })
      .sort({ timestamp: -1 })
      .limit(limit)
      .exec();
  }
}
