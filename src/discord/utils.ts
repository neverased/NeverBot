import 'dotenv/config';

import fs from 'node:fs/promises';
import path from 'node:path';

import { REST, Routes, SlashCommandBuilder } from 'discord.js';

interface Command {
  data: SlashCommandBuilder;
  execute: (...args: any[]) => void;
}

export async function setCommands(): Promise<void> {
  // Ensure necessary environment variables are set
  const botToken: string | undefined = process.env.BOT_TOKEN;
  const discordApplicationId: string | undefined =
    process.env.DISCORD_APPLICATION_ID;

  if (!botToken || !discordApplicationId) {
    console.error(
      '[ERROR] Missing required environment variables: BOT_TOKEN, DISCORD_APPLICATION_ID',
    );
    return;
  }

  const commands: Command[] = [];
  const foldersPath: string = path.join(__dirname, 'commands');

  try {
    const commandFolders: string[] = await fs.readdir(foldersPath);

    for (const folder of commandFolders) {
      const commandsPath: string = path.join(foldersPath, folder);
      const commandFiles: string[] = (await fs.readdir(commandsPath)).filter(
        (file) => file.endsWith('.js') || file.endsWith('.ts'),
      ); // Assuming TypeScript files might also be present

      for (const file of commandFiles) {
        const filePath: string = path.join(commandsPath, file);
        try {
          const { default: command }: { default: Command } = await import(
            filePath
          );

          if (command?.data && command?.execute) {
            console.log(`[INFO] Adding command from ${filePath}`);
            commands.push(command);
          } else {
            console.warn(
              `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`,
            );
          }
        } catch (importError) {
          console.error(
            `[ERROR] Failed to import command from ${filePath}: ${importError}`,
          );
        }
      }
    }

    const rest: REST = new REST().setToken(botToken);

    console.log(
      `Started refreshing ${commands.length} application (/) commands.`,
    );
    const data = await rest.put(
      Routes.applicationCommands(discordApplicationId),
      { body: commands.map((cmd) => cmd.data.toJSON()) },
    );

    if (data && Array.isArray(data)) {
      console.log(
        `Successfully reloaded ${data.length} application (/) commands.`,
      );
    } else {
      console.error(
        'Failed to reload commands. Data is not available or not in the expected format.',
      );
    }
  } catch (error) {
    console.error(`[ERROR] Failed to set commands: ${error.message}`);
  }
}
