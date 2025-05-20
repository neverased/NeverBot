export class UserMessage {
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
