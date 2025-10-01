import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ComponentType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';

import { ServersService } from '../../../servers/servers.service';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trap')
    .setDescription('Set trap time, date and channel.'),
  async execute(
    interaction,
    _userProfile,
    _userMessagesService,
    _usersService,
    serversService: ServersService,
  ) {
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 30000,
      retries: 0,
    });
    const selectTime = new StringSelectMenuBuilder()
      .setCustomId('select_time')
      .setPlaceholder('Select a time (UTC)')
      .addOptions(
        [...Array(24).keys()].map((h) =>
          new StringSelectMenuOptionBuilder()
            .setLabel(`${h}:00`)
            .setValue(`${h}:00`),
        ),
      );

    const selectDay = new StringSelectMenuBuilder()
      .setCustomId('select_day')
      .setPlaceholder('Does the trap start today or tomorrow?')
      .addOptions(
        new StringSelectMenuOptionBuilder().setLabel('Today').setValue('Today'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Tomorrow')
          .setValue('Tomorrow'),
      );

    const selectChannel = new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('Select a notification channel');

    const rowTime = new ActionRowBuilder().addComponents(selectTime);
    const rowDay = new ActionRowBuilder().addComponents(selectDay);
    const rowChannel = new ActionRowBuilder().addComponents(selectChannel);

    const response = await interaction.reply({
      content: `Please select a time for the trap to start:`,
      components: [rowTime],
      ephemeral: true,
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;

    const trapOptions: { time?: string; day?: string; channel?: string } = {};

    const collector = response.createMessageComponentCollector({
      filter: collectorFilter,
      componentType: ComponentType.StringSelect,
      time: 30000,
    });
    const channelCollector = response.createMessageComponentCollector({
      filter: collectorFilter,
      componentType: ComponentType.ChannelSelect,
      time: 30000,
    });

    collector.on('collect', async (i) => {
      if (i.customId === 'select_time') {
        trapOptions.time = i.values[0];
        i.update({
          content: `You have selected ${trapOptions.time} UTC.\nPlease select a day for the trap to start:`,
          components: [rowDay],
        });
      } else if (i.customId === 'select_day') {
        const nowUtc = new Date();
        const tomorrowUtc = new Date(nowUtc.getTime() + 24 * 60 * 60 * 1000);
        trapOptions.day =
          i.values[0] === 'Today'
            ? nowUtc.toISOString()
            : tomorrowUtc.toISOString();
        i.update({
          content: `You have selected ${trapOptions.time} UTC.\nYou have selected start time for ${trapOptions.day}.\nPlease select a channel for the notification to be sent to:`,
          components: [rowChannel],
        });
      }
    });

    channelCollector.on('collect', async (i) => {
      trapOptions.channel = i.values[0];
      const guildId = i.guildId;
      const guildName = i.guild?.name || 'N/A';
      try {
        await serversService.findOrCreateServer(guildId, guildName);
        await serversService.updateServerByDiscordServerId(guildId, {
          trap: {
            time: trapOptions.time,
            startDay: trapOptions.day,
            notificationChannelId: trapOptions.channel,
          },
        });
        await i.update({
          content: `You have selected:\nTime: ${trapOptions.time} UTC\nNotification starts: ${trapOptions.day}\nNotification will be sent to: <#${trapOptions.channel}>`,
          components: [],
        });
      } catch (error) {
        await i.update({
          content: `Error setting trap: ${error.message}`,
          components: [],
        });
      }
    });
  },
};
