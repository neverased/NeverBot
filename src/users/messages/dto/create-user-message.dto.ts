import { PartialType } from '@nestjs/mapped-types';

export class CreateUserMessageDto {
  userId: string;
  messageId: string;
  channelId: string;
  guildId?: string | null;
  scopeType: 'guild' | 'dm';
  scopeId: string;
  content: string;
  timestamp: Date;
  expiresAt?: Date;
  sentiment?: {
    score: number;
    comparative: number;
  };
  keywords?: string[];
}

export class UpdateUserMessageDto extends PartialType(CreateUserMessageDto) {}
