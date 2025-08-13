import {
  ChatInputCommandInteraction,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { ServersService } from '../../../servers/servers.service';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setwelcomechannel')
    .setDescription('Set the welcome channel for this server')
    .addChannelOption((option) =>
      option
        .setName('channel')
        .setDescription('The channel to use for welcome messages')
        .setRequired(true),
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild,
    ),

  async execute(
    interaction: ChatInputCommandInteraction,
    _userProfile: unknown,
    _userMessagesService: unknown,
    _usersService: unknown,
    serversService: ServersService,
  ) {
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return await interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    await interaction.deferReply({ ephemeral: true });

    const channel = interaction.options.getChannel('channel');
    const guildId = interaction.guildId;
    const guildName = interaction.guild?.name || 'N/A';

    if (!channel || !guildId) {
      return await interaction.editReply(
        'Missing channel or guild context to set welcome channel.',
      );
    }

    try {
      await serversService.findOrCreateServer(guildId, guildName);
      await serversService.updateServerByDiscordServerId(guildId, {
        welcomeChannelId: channel.id,
      });
      await interaction.editReply(
        `Welcome channel set to <#${channel.id}> successfully.`,
      );
    } catch (error) {
      console.error('Error setting welcome channel:', error);
      await interaction.editReply(
        'Failed to set welcome channel. Please try again later.',
      );
    }
  },
};
