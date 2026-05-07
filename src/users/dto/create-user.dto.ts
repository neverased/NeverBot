import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export interface GuildMembershipDto {
  guildId: string;
  guildName: string;
  joinedAt?: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  leftAt?: Date | null;
  source: 'observed' | 'guild_member_sync' | 'guild_member_add';
}

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
  guildMemberships?: GuildMembershipDto[];
  @IsOptional()
  @IsString()
  subscription: string;
  @IsOptional()
  tasks?: {
    enabledChannels?: string[];
    welcome_channel_id?: string;
  };
}
