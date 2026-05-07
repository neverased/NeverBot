export interface UserTasks {
  enabledChannels?: string[];
  welcome_channel_id?: string;
}

export interface GuildMembership {
  guildId: string;
  guildName: string;
  joinedAt?: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  leftAt?: Date | null;
  source: 'observed' | 'guild_member_sync' | 'guild_member_add';
}

export class User {
  discordUserId: string;
  registeredAt: Date;
  serverName: string;
  serverId: string;
  guildMemberships?: GuildMembership[];
  subscription: string;
  messageCount: number;
  lastSeen: Date;
  topicsOfInterest: string[];
  sentimentHistory: { sentiment: string; score: number; timestamp: Date }[];
  personalitySummary: string;
  personalitySummaryStatus?: string;
  personalitySummaryUpdatedAt?: Date;
  personalitySummaryMessageCount?: number;
  personalitySummaryVersion?: string;
  personalitySummaryError?: string;
  personalitySummarySampleFrom?: Date;
  personalitySummarySampleTo?: Date;
  personalitySummaryGuildCount?: number;
  personalitySummaryDmCount?: number;
  personalitySummaryScopeTypes?: string[];
  tasks?: UserTasks;
}
