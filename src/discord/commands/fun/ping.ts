import { SlashCommandBuilder } from 'discord.js';

import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ping')
    .setDescription('Replies with Pong!'),
  async execute(interaction) {
    // Make ping fast and not retried long
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 2000,
      retries: 0,
    });
    await interaction.reply('Pong!');
  },
};
