//Bot command to het the list of available commands.

import { SlashCommandBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('help')
    .setDescription('Displays all available commands'),
  async execute(interaction) {
    await interaction.deferReply();
    const commands = interaction.client.commands.map((command) => command.data.toJSON());
    const commandList = commands.map((command) => `/${command.name} - ${command.description}`).join('\n');
    await interaction.editReply(`Here is a list of all available commands:\n${commandList}`);
  },
};
