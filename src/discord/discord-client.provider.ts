import { Injectable } from '@nestjs/common';
import { Client, GatewayIntentBits, Partials } from 'discord.js';

@Injectable()
export class DiscordClientProvider {
  create(): Client {
    return new Client({
      intents: [
        GatewayIntentBits.Guilds,
        GatewayIntentBits.GuildMessages,
        GatewayIntentBits.GuildMessageReactions,
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.MessageContent,
      ],
      partials: [
        Partials.Reaction,
        Partials.Message,
        Partials.User,
        Partials.Channel,
        Partials.GuildMember,
      ],
    });
  }
}
