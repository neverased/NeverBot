import 'dotenv/config';

// Use require for built-in Node.js modules for potentially better script compatibility
const fs = require('node:fs/promises');
const path = require('node:path');

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
      );

      for (const file of commandFiles) {
        const filePath: string = path.join(commandsPath, file);
        try {
          const importedModule = await import(filePath);

          // Check if the command is the default export or the module itself
          let command: Command | undefined = undefined;
          if (
            importedModule.default &&
            importedModule.default.data &&
            importedModule.default.execute
          ) {
            command = importedModule.default;
          } else if (importedModule.data && importedModule.execute) {
            command = importedModule;
          }

          if (command && command.data && command.execute) {
            console.log(`[INFO] Adding command from ${filePath}`);
            commands.push(command);
          } else {
            console.warn(
              `[WARNING] The command at ${filePath} is missing a required "data" or "execute" property (or module structure is unexpected).`,
            );
            // For debugging, log the structure of the imported module
            // console.log(`[DEBUG] Imported module structure from ${filePath}:`, JSON.stringify(importedModule, null, 2));
            // console.log(`[DEBUG] Keys in imported module:`, Object.keys(importedModule));
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
    if (error.message.includes(foldersPath)) {
      console.error(
        `[ERROR] Could not read command folders. Path used: ${foldersPath}. Error: ${error.message}`,
      );
    } else {
      console.error(`[ERROR] Failed to set commands: ${error.message}`);
    }
  }
}
