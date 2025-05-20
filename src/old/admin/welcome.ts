import axios from 'axios';
import { SlashCommandBuilder } from 'discord.js';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set the welcome channel')
    .addChannelOption((option) =>
      option
        .setName('welcome')
        .setDescription('The channel to set as the welcome channel')
        .setRequired(true),
    )
    .setDefaultMemberPermissions(0),
  async execute(interaction) {
    await interaction.deferReply();
    const apiUrl = process.env.API_URL || 'http://localhost:3500';
    const guildId = interaction.guildId;
    const welcomeChannelId = interaction.options.getChannel('welcome').id;

    try {
      const response = await axios.get(`${apiUrl}/users/${guildId}`);
      // User/server config exists, so update it
      const serverUpdateData = {
        tasks: {
          ...response.data.tasks,
          welcome_channel_id: welcomeChannelId,
        },
      };
      await axios.patch(`${apiUrl}/users/${guildId}`, serverUpdateData);
      await interaction.editReply(
        `Welcome channel was updated to ${interaction.options.getChannel('welcome')}.`,
      );
    } catch (error) {
      if (error.response && error.response.status === 404) {
        // User/server config does not exist, so create it
        const serverCreateData = {
          serverId: guildId,
          serverName: interaction.guild.name,
          tasks: {
            welcome_channel_id: welcomeChannelId,
          },
        };
        try {
          await axios.post(`${apiUrl}/users`, serverCreateData);
          await interaction.editReply(
            `User added to database and welcome channel was set to ${interaction.options.getChannel(
              'welcome',
            )}.`,
          );
        } catch (postError) {
          console.error('Error creating server config:', postError.message);
          await interaction.editReply(
            `Error creating server config: ${postError.message}`,
          );
        }
      } else {
        // Other errors (network issue, server error, etc.)
        console.error('Error fetching/updating server config:', error.message);
        const errorMessage = error.response
          ? `${error.response.status} - ${error.response.statusText}`
          : error.message;
        await interaction.editReply(
          `Error setting welcome channel: ${errorMessage}`,
        );
      }
    }
  },
};
