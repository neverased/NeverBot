import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateUserDto {
  @IsNotEmpty()
  @IsString()
  discordUserId: string;

  registeredAt: Date;
  @IsOptional()
  @IsString()
  serverName: string;
  @IsOptional()
  @IsString()
  serverId: string;
  @IsOptional()
  @IsString()
  subscription: string;
  @IsOptional()
  tasks?: {
    enabledChannels?: string[];
    welcome_channel_id?: string;
    trap?: {
      time?: string;
      start_day?: string;
      notification_channel_id?: string;
    };
  };
}
