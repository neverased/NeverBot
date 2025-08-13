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

  @Prop({
    type: {
      time: { type: String },
      startDay: { type: String },
      notificationChannelId: { type: String },
    },
    default: undefined,
  })
  trap?: {
    time?: string;
    startDay?: string;
    notificationChannelId?: string;
  };
}

export const ServerSchema = SchemaFactory.createForClass(Server);
