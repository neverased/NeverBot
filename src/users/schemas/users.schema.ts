import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

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

  @Prop({
    type: {
      enabledChannels: { type: [String], default: [] },
      welcome_channel_id: { type: String, required: false },
      trap: {
        time: { type: String, required: false },
        start_day: { type: String, required: false },
        notification_channel_id: { type: String, required: false },
      },
    },
    default: {},
  })
  tasks: {
    enabledChannels?: string[];
    welcome_channel_id?: string;
    trap?: {
      time?: string;
      start_day?: string;
      notification_channel_id?: string;
    };
  };
}

export const UserSchema = SchemaFactory.createForClass(User);
UserSchema.index({ lastSeen: -1 });
UserSchema.index({ serverId: 1 });
