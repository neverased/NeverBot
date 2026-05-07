export interface UserTasks {
  enabledChannels?: string[];
  welcome_channel_id?: string;
}

export class User {
  discordUserId: string;
  registeredAt: Date;
  serverName: string;
  serverId: string;
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
  tasks?: UserTasks;
}
