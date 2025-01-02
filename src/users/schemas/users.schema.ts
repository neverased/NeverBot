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

const schemaWelcome = SchemaFactory.createForClass(Welcome);

export type UserDocument = HydratedDocument<User>;

@Schema()
export class User {
  @Prop({ type: Date, default: Date.now })
  registeredAt: Date;

  @Prop({ type: String })
  serverName: string;

  @Prop({ type: String })
  serverId: string;

  @Prop({ type: String, default: 'free' })
  subscription: string;

  @Prop({ type: mongoose.Schema.Types.Mixed, default: {} })
  tasks: mongoose.Schema.Types.Mixed;
}

export const UserSchema = SchemaFactory.createForClass(User);
