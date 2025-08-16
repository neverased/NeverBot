import { Injectable, Logger } from '@nestjs/common';
import { ChatInputCommandInteraction, Collection } from 'discord.js';
import * as fs from 'fs/promises';
import * as path from 'path';

export interface Command {
  data: { name: string; description?: string };
  execute: (
    interaction: ChatInputCommandInteraction,
    ...args: any[]
  ) => Promise<void>;
}

@Injectable()
export class CommandRegistry {
  private readonly logger = new Logger(CommandRegistry.name);
  private readonly commands = new Collection<string, Command>();

  get(): Collection<string, Command> {
    return this.commands;
  }

  async loadFromFolder(folder: string): Promise<void> {
    try {
      await fs.access(folder);
    } catch {
      this.logger.warn(`Commands folder not found at path: ${folder}`);
      return;
    }
    const commandFolders = await fs.readdir(folder);
    for (const sub of commandFolders) {
      const commandsPath = path.join(folder, sub);
      const files = (await fs.readdir(commandsPath)).filter((f) => {
        if (f.endsWith('.d.ts')) return false;
        return f.endsWith('.js') || f.endsWith('.ts');
      });
      for (const file of files) {
        const filePath = path.join(commandsPath, file);
        const importedModule: any = await import(filePath);
        const command: Command | undefined =
          importedModule?.default &&
          importedModule.default.data &&
          importedModule.default.execute
            ? (importedModule.default as Command)
            : importedModule?.data && importedModule.execute
              ? (importedModule as Command)
              : undefined;
        if (command?.data?.name && command?.execute) {
          this.commands.set(command.data.name, command);
          this.logger.log(`Loaded command: ${command.data.name}`);
        } else {
          this.logger.warn(
            `The command at ${filePath} is missing a required "data" or "execute" property.`,
          );
        }
      }
    }
  }
}
