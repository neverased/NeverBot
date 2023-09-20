import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Client,
  GatewayIntentBits,
  Events,
  Collection,
  Partials,
  ActivityType,
} from 'discord.js';
import 'dotenv/config';
import fs from 'fs';
import * as path from 'path';
import { setCommands } from './utils';
import { translateText } from './translator/translate';
import { textFromImage } from './translator/cv_scrape';
import { discordFlagToLanguageCode } from './translator/translate';
import { welcomeNewMember } from './events/guildMemberAdd';
import { goodbyeOldMember } from './events/guildMemberRemove';

@Injectable()
export class DiscordService implements OnModuleInit {
  private readonly token = process.env.BOT_TOKEN;
  private readonly client = new Client({
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
  }) as any;

  constructor() {
    this.client.commands = new Collection();
    this.getCommands();
  }

  getCommands(): any {
    const foldersPath = path.join(__dirname, 'commands');
    const commandFolders = fs.readdirSync(foldersPath);

    for (const folder of commandFolders) {
      const commandsPath = path.join(foldersPath, folder);

      const commandFiles = fs
        .readdirSync(commandsPath)
        .filter((file) => file.endsWith('.js'));

      for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        const command = require(filePath);
        // Set a new item in the Collection with the key as the command name and the value as the exported module
        if ('data' in command && 'execute' in command) {
          this.client.commands.set(command.data.name, command);
        } else {
          console.log(
            `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
          );
        }
      }
    }
  }

  async onModuleInit(): Promise<void> {
    this.client.on(Events.InteractionCreate, (interaction) => {
      if (!interaction.isChatInputCommand()) return;

      const command = interaction.client.commands.get(interaction.commandName);

      if (!command) {
        console.error(
          `No command matching ${interaction.commandName} was found.`,
        );
        return;
      }

      try {
        command.execute(interaction);
      } catch (error) {
        console.error(error);
        if (interaction.replied || interaction.deferred) {
          interaction.followUp({
            content: 'There was an error while executing this command!',
            ephemeral: true,
          });
        } else {
          interaction.reply({
            content: 'There was an error while executing this command!',
            ephemeral: true,
          });
        }
      }
    });

    this.client.on(Events.ClientReady, () => {
      console.log('Client is ready!');
      setCommands();
    });

    this.client.on(Events.GuildMemberAdd, async (member) => {
      await welcomeNewMember(member);
    });

    this.client.on(Events.GuildMemberRemove, async (member) => {
      await goodbyeOldMember(member);
    });

    this.client.on(Events.MessageReactionAdd, async (reaction, user) => {
      if (reaction.partial) {
        // If the message this reaction belongs to was removed, the fetching might result in an API error which should be handled
        try {
          await reaction.fetch();
        } catch (error) {
          console.error(
            'Something went wrong when fetching the message:',
            error,
          );
          // Return as `reaction.message.author` may be undefined/null
          return;
        }
      }

      const isTranslation = discordFlagToLanguageCode({
        emoji: reaction.emoji.name,
      });
      console.log('isTranslation: ' + isTranslation);
      if (isTranslation == null) return;

      const [firstValue] =
        reaction.message.attachments.values() == undefined
          ? null
          : reaction.message.attachments.values();
      if (firstValue != null) {
        if (firstValue.contentType == 'image/png') {
          const scrape = await textFromImage({
            imgLink: firstValue.url,
            emoji: reaction.emoji.name,
            user,
          });
          if (scrape == undefined || null) return;
          reaction.message.reply({ embeds: [scrape] });
        }
      } else {
        const traslation = await translateText(
          reaction.emoji.name,
          reaction.message.content,
          user,
        );
        if (traslation == null) return;
        reaction.message.reply({ embeds: [traslation] });
      }
      //console.log(reaction.message);
    });

    await this.client.login(this.token);

    await this.client.user.setActivity('/help', {
      type: ActivityType.Listening,
    });
  }
}
