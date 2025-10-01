import { PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';

import { ServersService } from '../../../servers/servers.service';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('resetconversation')
    .setDescription(
      'Reset the per-channel conversation state for this channel.',
    )
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild,
    ),
  async execute(
    interaction,
    _userProfile,
    _userMessagesService,
    _usersService,
    serversService: ServersService,
  ) {
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 8000,
      retries: 0,
    });
    await interaction.deferReply({ ephemeral: true });
    if (!interaction.guild || !serversService) {
      await interaction.editReply('Server context unavailable.');
      return;
    }
    try {
      await serversService.setChannelConversationId(
        interaction.guild.id,
        interaction.channelId,
        '',
      );
      await serversService.pruneStaleChannelConversations(
        interaction.guild.id,
        0,
        0,
      );
      await interaction.editReply(
        'Conversation state for this channel has been reset.',
      );
    } catch {
      await interaction.editReply('Failed to reset conversation state.');
    }
  },
};
