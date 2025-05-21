import { PartialType } from '@nestjs/mapped-types';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDate,
  IsNumber,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

import { CreateUserDto } from './create-user.dto';

// Define a DTO for the sentiment history items for validation
class SentimentHistoryItemDto {
  @IsString()
  sentiment: string;

  @IsNumber()
  score: number;

  @IsDate()
  timestamp: Date;
}

export class UpdateUserDto extends PartialType(CreateUserDto) {
  @IsOptional()
  @IsString()
  discordUserId?: string;

  registeredAt: Date;
  serverName: string;
  serverId: string;
  subscription: string;
  tasks: any;

  @IsOptional()
  @IsNumber()
  messageCount?: number;

  @IsOptional()
  @IsDate()
  lastSeen?: Date;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  topicsOfInterest?: string[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SentimentHistoryItemDto)
  sentimentHistory?: SentimentHistoryItemDto[];

  @IsOptional()
  @IsString()
  personalitySummary?: string;
}
