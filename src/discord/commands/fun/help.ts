//Bot command to het the list of available commands.

import { SlashCommandBuilder } from 'discord.js';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays all available commands'),
  async execute(interaction) {
    // Help does I/O over commands map; short timeout but safe
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 5000,
      retries: 0,
    });
    await interaction.deferReply();
    const commands = interaction.client.commands.map((command) =>
      command.data.toJSON(),
    );
    const commandList = commands
      .map((command) => `/${command.name} - ${command.description}`)
      .join('\n');
    await interaction.editReply(
      `Here is a list of all available commands:\n${commandList}`,
    );
  },
};
