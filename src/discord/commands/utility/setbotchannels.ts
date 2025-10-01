import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  ComponentType,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';

import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

const CUSTOM_ID = 'setbotchannels_select';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('setbotchannels')
    .setDescription('Set which channels the bot is enabled in for this server.')
    .setDefaultMemberPermissions(
      PermissionFlagsBits.Administrator | PermissionFlagsBits.ManageGuild,
    ),

  /**
   * @param {import('discord.js').ChatInputCommandInteraction} interaction
   * @param {any} _userProfile
   * @param {any} _userMessagesService
   * @param {any} _usersService
   * @param {ServersService} serversService
   */
  async execute(
    interaction,
    _userProfile,
    _userMessagesService,
    _usersService,
    serversService,
  ) {
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 30000,
      retries: 0,
    });
    if (
      !interaction.memberPermissions?.has(PermissionFlagsBits.Administrator) &&
      !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)
    ) {
      return await interaction.reply({
        content: 'You do not have permission to use this command.',
        ephemeral: true,
      });
    }

    const channelSelect = new ChannelSelectMenuBuilder()
      .setCustomId(CUSTOM_ID)
      .setPlaceholder('Select up to 3 channels')
      .setMinValues(1)
      .setMaxValues(3)
      .addChannelTypes(ChannelType.GuildText);

    const row = new ActionRowBuilder().addComponents(channelSelect);

    await interaction.reply({
      content: 'Please select the channels where the bot should be enabled:',
      components: [row],
      ephemeral: true,
    });

    // Set up a collector for the select menu interaction
    const collector = interaction.channel.createMessageComponentCollector({
      componentType: ComponentType.ChannelSelect,
      time: 60_000,
      filter: (i) =>
        i.user.id === interaction.user.id && i.customId === CUSTOM_ID,
      max: 1,
    });

    collector.on('collect', async (selectInteraction) => {
      const selectedChannels = selectInteraction.values; // array of channel IDs
      const guildId = interaction.guildId;
      const guildName = interaction.guild?.name || 'N/A';
      try {
        // Fetch or create the server config in servers collection
        await serversService.findOrCreateServer(guildId, guildName);
        await serversService.updateServerByDiscordServerId(guildId, {
          enabledChannels: selectedChannels,
        });
        await selectInteraction.update({
          content: `Bot enabled in: ${selectedChannels
            .map((id) => `<#${id}>`)
            .join(', ')}`,
          components: [],
          ephemeral: true,
        });
      } catch (error) {
        console.error('Error updating enabled channels:', error);
        await selectInteraction.update({
          content:
            'Failed to update enabled channels. Please try again or contact an admin.',
          components: [],
          ephemeral: true,
        });
      }
    });

    collector.on('end', async (collected) => {
      if (collected.size === 0) {
        await interaction.editReply({
          content: 'No channels were selected. Command timed out.',
          components: [],
        });
      }
    });
  },
};
