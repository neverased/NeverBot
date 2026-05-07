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
import { GuildMembershipDto } from './create-user.dto';

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

  @IsOptional()
  @IsDate()
  registeredAt?: Date;

  @IsOptional()
  @IsString()
  serverName?: string;

  @IsOptional()
  @IsString()
  serverId?: string;

  @IsOptional()
  guildMemberships?: GuildMembershipDto[];

  @IsOptional()
  @IsString()
  subscription?: string;
  @IsOptional()
  tasks?: {
    enabledChannels?: string[];
    welcome_channel_id?: string;
  };

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

  @IsOptional()
  @IsString()
  personalitySummaryStatus?: string;

  @IsOptional()
  @IsDate()
  personalitySummaryUpdatedAt?: Date;

  @IsOptional()
  @IsNumber()
  personalitySummaryMessageCount?: number;

  @IsOptional()
  @IsString()
  personalitySummaryVersion?: string;

  @IsOptional()
  @IsString()
  personalitySummaryError?: string;

  @IsOptional()
  @IsDate()
  personalitySummarySampleFrom?: Date;

  @IsOptional()
  @IsDate()
  personalitySummarySampleTo?: Date;

  @IsOptional()
  @IsNumber()
  personalitySummaryGuildCount?: number;

  @IsOptional()
  @IsNumber()
  personalitySummaryDmCount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  personalitySummaryScopeTypes?: string[];
}
