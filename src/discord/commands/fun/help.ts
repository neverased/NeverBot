//Bot command to het the list of available commands.

import { SlashCommandBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Displays all available commands'),
  async execute(interaction) {
    await interaction.reply('Coming soon!');
  },
};
