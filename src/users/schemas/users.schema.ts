import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UsersDocument = HydratedDocument<Users>;

@Schema()
export class Users {
  @Prop()
  serverName: string;

  @Prop()
  ServerId: string;

  @Prop()
  tasks: Array<Object>
}

export const UsersSchema = SchemaFactory.createForClass(Users);