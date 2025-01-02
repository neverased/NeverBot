import 'dotenv/config';

import { Injectable, Logger,OnModuleInit } from '@nestjs/common';
import {
  ActivityType,
  Client,
  Collection,
  CommandInteraction,
  Events,
  GatewayIntentBits,
  Interaction,
  MessageReaction,
  Partials,
  User,
} from 'discord.js';
import * as fs from 'fs';
import * as path from 'path';

import { textFromImage } from './translator/cv_scrape';
import { translateText } from './translator/translate';
import { discordFlagToLanguageCode } from './translator/translate';

interface Command {
  data: { name: string };
  execute: (interaction: CommandInteraction) => Promise<void>;
}

declare module 'discord.js' {
  interface Client {
    commands: Collection<string, Command>;
  }
}

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly logger = new Logger(DiscordService.name);
  private readonly token = process.env.BOT_TOKEN;
  private readonly client: Client;

  constructor() {
    this.validateToken();
    this.client = this.initializeClient();
    this.client.commands = new Collection<string, Command>();
    this.loadCommands();
  }

  private validateToken(): void {
    if (!this.token) {
      this.logger.error('BOT_TOKEN environment variable is not set.');
      throw new Error('BOT_TOKEN environment variable is not set.');
    }
  }

  private initializeClient(): Client {
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

  private async loadCommands(): Promise<void> {
    const foldersPath = path.join(__dirname, 'commands');
    if (!fs.existsSync(foldersPath)) {
      this.logger.warn(`Commands folder not found at path: ${foldersPath}`);
      return;
    }

    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);
      const commandFiles = fs.readdirSync(commandsPath).filter((file) => file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command: Command = await import(filePath);
        if (command.data && command.execute) {
          this.client.commands.set(command.data.name, command);
        } else {
          this.logger.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
        }
      }
    }
  }

  async onModuleInit(): Promise<void> {
    this.client.on(Events.InteractionCreate, async (interaction: Interaction) => {
      if (!interaction.isCommand()) return;
      const commandInteraction = interaction as CommandInteraction;
      const command = this.client.commands.get(commandInteraction.commandName);

      if (!command) {
        this.logger.error(`No command matching ${commandInteraction.commandName} was found.`);
        return;
      }

      try {
        await command.execute(commandInteraction);
      } catch (error) {
        this.logger.error(`Error executing command ${commandInteraction.commandName}:`, error);
        await this.handleError(commandInteraction);
      }
    });

    this.client.on(Events.ClientReady, () => {
      this.logger.log('Client is ready!');
      this.setClientActivity();
    });

    this.client.on(Events.MessageReactionAdd, async (reaction: MessageReaction, user: User) => {
      await this.handleMessageReaction(reaction, user);
    });

    await this.loginClient();
  }

  private async handleError(interaction: CommandInteraction): Promise<void> {
    const replyOptions = {
      content: 'There was an error while executing this command!',
      ephemeral: true,
    };
    if (interaction.replied || interaction.deferred) {
      await interaction.followUp(replyOptions);
    } else {
      await interaction.reply(replyOptions);
    }
  }

  private async handleMessageReaction(reaction: MessageReaction, user: User): Promise<void> {
    try {
      if (reaction.partial) await reaction.fetch();
      const isTranslation = discordFlagToLanguageCode({ emoji: reaction.emoji.name });
      if (!isTranslation) return;

      const attachment = reaction.message.attachments.first();
      if (attachment && attachment.contentType?.startsWith('image/')) {
        const scrape = await textFromImage({
          imgLink: attachment.url,
          emoji: reaction.emoji.name,
          user,
        });
        if (scrape) await reaction.message.reply({ embeds: [scrape] });
      } else {
        const translation = await translateText(reaction.emoji.name, reaction.message.content, user);
        if (translation) await reaction.message.reply({ embeds: [translation] });
      }
    } catch (error) {
      this.logger.error('Error handling message reaction:', error);
    }
  }

  private async setClientActivity(): Promise<void> {
    if (!this.client.user) return;
    await this.client.user.setActivity('/help', {
      type: ActivityType.Listening,
    });
  }

  private async loginClient(): Promise<void> {
    try {
      await this.client.login(this.token);
    } catch (error) {
      this.logger.error('Error logging in the Discord client:', error);
    }
  }
}