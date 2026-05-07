import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';

export type UserMessageDocument = UserMessage & Document;

@Schema({ timestamps: true })
export class UserMessage {
  @Prop({ required: true, index: true })
  userId: string;

  @Prop({ required: true, unique: true, index: true })
  messageId: string;

  @Prop({ required: true, index: true })
  channelId: string;

  @Prop({ required: false, index: true, default: null })
  guildId?: string | null;

  @Prop({ type: String, enum: ['guild', 'dm'], required: true, index: true })
  scopeType: 'guild' | 'dm';

  @Prop({ type: String, required: true, index: true })
  scopeId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  sentiment?: {
    score: number;
    comparative: number;
  };

  @Prop([String])
  keywords?: string[];

  @Prop({ required: true, type: Date, default: Date.now })
  timestamp: Date;

  @Prop({ type: Date })
  expiresAt?: Date;
}

export const UserMessageSchema = SchemaFactory.createForClass(UserMessage);
UserMessageSchema.index({ userId: 1, timestamp: -1 });
UserMessageSchema.index({ guildId: 1, channelId: 1, timestamp: -1 });
UserMessageSchema.index({ scopeType: 1, scopeId: 1, timestamp: -1 });
UserMessageSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });
