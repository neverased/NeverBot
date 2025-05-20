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

  @Prop({ required: true, index: true })
  guildId: string;

  @Prop({ required: true })
  content: string;

  @Prop({ type: MongooseSchema.Types.Mixed })
  sentiment?: {
    score: number;
    comparative: number;
    tokens: string[];
    words: string[];
  };

  @Prop([String])
  keywords?: string[];

  @Prop({ required: true, type: Date, default: Date.now })
  timestamp: Date;
}

export const UserMessageSchema = SchemaFactory.createForClass(UserMessage);
