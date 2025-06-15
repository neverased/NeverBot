import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';

@Schema()
export class Server {
  @Prop({ type: String, required: true, unique: true })
  discordServerId: string;

  @Prop({ type: String })
  serverName: string;

  @Prop({ type: [String], default: [] })
  enabledChannels: string[];

  @Prop({ type: String })
  welcomeChannelId: string;
}

export const ServerSchema = SchemaFactory.createForClass(Server);
