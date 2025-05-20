import { PartialType } from '@nestjs/mapped-types';

export class CreateUserMessageDto {
  userId: string;
  messageId: string;
  channelId: string;
  guildId: string;
  content: string;
  timestamp: Date;
  sentiment?: {
    score: number;
    comparative: number;
    tokens: string[];
    words: string[];
  };
  keywords?: string[];
}

export class UpdateUserMessageDto extends PartialType(CreateUserMessageDto) {}
