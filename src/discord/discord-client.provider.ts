import { Injectable } from '@nestjs/common';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

@Injectable()
export class DiscordClientProvider {
  create(): Client {
    return new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.DirectMessages,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [Partials.Message, Partials.Channel, Partials.GuildMember],
    });
  }
}
