import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

export type GuildMembershipSource =
  | 'observed'
  | 'guild_member_sync'
  | 'guild_member_add';

export class GuildMembership {
  guildId: string;
  guildName: string;
  joinedAt?: Date;
  firstSeenAt: Date;
  lastSeenAt: Date;
  leftAt?: Date | null;
  source: GuildMembershipSource;
}

@Schema()
export class User {
  @Prop({ type: String, required: true, unique: true })
  discordUserId: string;

  @Prop({ type: Date, default: Date.now })
  registeredAt: Date;

  @Prop({ type: String })
  serverName: string;

  @Prop({ type: String })
  serverId: string;

  @Prop({
    type: [
      {
        guildId: { type: String, required: true },
        guildName: { type: String, default: 'N/A' },
        joinedAt: { type: Date },
        firstSeenAt: { type: Date, default: Date.now },
        lastSeenAt: { type: Date, default: Date.now },
        leftAt: { type: Date, default: null },
        source: { type: String, default: 'observed' },
      },
    ],
    default: [],
  })
  guildMemberships: GuildMembership[];

  @Prop({ type: String, default: 'free' })
  subscription: string;

  @Prop({ type: Number, default: 0 })
  messageCount: number;

  @Prop({ type: Date, default: Date.now })
  lastSeen: Date;

  @Prop({ type: [String], default: [] })
  topicsOfInterest: string[];

  @Prop({
    type: [{ sentiment: String, score: Number, timestamp: Date }],
    default: [],
  })
  sentimentHistory: { sentiment: string; score: number; timestamp: Date }[];

  @Prop({ type: String, default: '' })
  personalitySummary: string;

  @Prop({ type: String, default: 'pending' })
  personalitySummaryStatus: string;

  @Prop({ type: Date })
  personalitySummaryUpdatedAt?: Date;

  @Prop({ type: Number, default: 0 })
  personalitySummaryMessageCount: number;

  @Prop({ type: String, default: '' })
  personalitySummaryVersion: string;

  @Prop({ type: String, default: '' })
  personalitySummaryError: string;

  @Prop({ type: Date })
  personalitySummarySampleFrom?: Date;

  @Prop({ type: Date })
  personalitySummarySampleTo?: Date;

  @Prop({ type: Number, default: 0 })
  personalitySummaryGuildCount: number;

  @Prop({ type: Number, default: 0 })
  personalitySummaryDmCount: number;

  @Prop({ type: [String], default: [] })
  personalitySummaryScopeTypes: string[];

  @Prop({
    type: {
      enabledChannels: { type: [String], default: [] },
      welcome_channel_id: { type: String, required: false },
    },
    default: {},
  })
  tasks: {
    enabledChannels?: string[];
    welcome_channel_id?: string;
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ lastSeen: -1 });
UserSchema.index({ serverId: 1 });
UserSchema.index({ 'guildMemberships.guildId': 1 });
