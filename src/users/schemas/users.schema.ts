import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';
import * as mongoose from 'mongoose';

@Schema()
export class Welcome {
  @Prop({ type: String })
  welcome_channel_id: string;

  @Prop({ type: String })
  welcome_message: string;
}

const _schemaWelcome = SchemaFactory.createForClass(Welcome);

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

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  tasks: mongoose.Schema.Types.Mixed;
}

export const UserSchema = SchemaFactory.createForClass(User);
