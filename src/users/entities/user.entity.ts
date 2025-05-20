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
  tasks: any;
}
