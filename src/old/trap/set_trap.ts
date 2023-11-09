import axios from 'axios';
import {
  ActionRowBuilder,
  ChannelSelectMenuBuilder,
  ComponentType,
  SlashCommandBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
} from 'discord.js';
import 'dayjs';
import * as dayjs from 'dayjs';
import * as utc from 'dayjs/plugin/utc';
dayjs.extend(utc);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('trap')
    .setDescription('Set trap time ,date and channel.'),
  async execute(interaction) {
    // menu for setting up the trap schedule
    // 1. Display the grid of times (24 hours)
    // 2. Allow user to select a time slot
    // 3. Ask user if the trap starts today or tomorrow

    const selectTime = new StringSelectMenuBuilder()
      .setCustomId('select_time')
      .setPlaceholder('Select a time (UTC)')
      .addOptions([
        new StringSelectMenuOptionBuilder().setLabel('0:00').setValue('0:00'),
        new StringSelectMenuOptionBuilder().setLabel('1:00').setValue('1:00'),
        new StringSelectMenuOptionBuilder().setLabel('2:00').setValue('2:00'),
        new StringSelectMenuOptionBuilder().setLabel('3:00').setValue('3:00'),
        new StringSelectMenuOptionBuilder().setLabel('4:00').setValue('4:00'),
        new StringSelectMenuOptionBuilder().setLabel('5:00').setValue('5:00'),
        new StringSelectMenuOptionBuilder().setLabel('6:00').setValue('6:00'),
        new StringSelectMenuOptionBuilder().setLabel('7:00').setValue('7:00'),
        new StringSelectMenuOptionBuilder().setLabel('8:00').setValue('8:00'),
        new StringSelectMenuOptionBuilder().setLabel('9:00').setValue('9:00'),
        new StringSelectMenuOptionBuilder().setLabel('10:00').setValue('10:00'),
        new StringSelectMenuOptionBuilder().setLabel('11:00').setValue('11:00'),
        new StringSelectMenuOptionBuilder().setLabel('12:00').setValue('12:00'),
        new StringSelectMenuOptionBuilder().setLabel('13:00').setValue('13:00'),
        new StringSelectMenuOptionBuilder().setLabel('14:00').setValue('14:00'),
        new StringSelectMenuOptionBuilder().setLabel('15:00').setValue('15:00'),
        new StringSelectMenuOptionBuilder().setLabel('16:00').setValue('16:00'),
        new StringSelectMenuOptionBuilder().setLabel('17:00').setValue('17:00'),
        new StringSelectMenuOptionBuilder().setLabel('18:00').setValue('18:00'),
        new StringSelectMenuOptionBuilder().setLabel('19:00').setValue('19:00'),
        new StringSelectMenuOptionBuilder().setLabel('20:00').setValue('20:00'),
        new StringSelectMenuOptionBuilder().setLabel('21:00').setValue('21:00'),
        new StringSelectMenuOptionBuilder().setLabel('22:00').setValue('22:00'),
        new StringSelectMenuOptionBuilder().setLabel('23:00').setValue('23:00'),
      ]);

    const selectDay = new StringSelectMenuBuilder()
      .setCustomId('select_day')
      .setPlaceholder('Does the trap start today or tomorrow?')
      .addOptions([
        new StringSelectMenuOptionBuilder().setLabel('Today').setValue('Today'),
        new StringSelectMenuOptionBuilder()
          .setLabel('Tomorrow')
          .setValue('Tomorrow'),
      ]);

    const selectChannel = new ChannelSelectMenuBuilder()
      .setCustomId('select_channel')
      .setPlaceholder('Select a notification channel');

    const rowTime = new ActionRowBuilder().addComponents(selectTime);

    const rowDay = new ActionRowBuilder().addComponents(selectDay);

    const rowChannel = new ActionRowBuilder().addComponents(selectChannel);

    const response = await interaction.reply({
      content: `Please select a time for the trap to start:`,
      components: [rowTime],
    });

    const collectorFilter = (i) => i.user.id === interaction.user.id;

    try {
      const trapOptions = new Object() as {
        time: string;
        day: string;
        channel: string;
      };

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
        console.log(i, 'i');

        if (i.customId === 'select_time') {
          trapOptions.time = i.values[0];

          i.update({
            content: `You have selected ${trapOptions.time} UTC.\nPlease select a day for the trap to start:`,
            components: [rowDay],
          });
          // const selection = i.values[0];
          // await i.reply(`${i.user} has selected ${selection}!`);
        } else if (i.customId === 'select_day') {
          trapOptions.day =
            i.values[0] === 'Today'
              ? dayjs.utc().format()
              : dayjs().add(1, 'day').utc().format();

          i.update({
            content: `You have selected ${trapOptions.time} UTC.\nYou have selected start time for ${trapOptions.day}.\nPlease select a channel for the notification to be send to:`,
            components: [rowChannel],

            // const selection = i.values[0];
            // await i.reply(`${i.user} has selected ${selection}!`);
          });
        }
      });

      channelCollector.on('collect', async (i) => {
        trapOptions.channel = i.values[0];

        await axios
          .get(`http://localhost:3500/users/${i.guildId}`)
          .then((response) => {
            //console.log(response, 'response');

            if (response.data.statusCode != 404) {
              // If it does, update it
              const server = {
                tasks: {
                  ...response.data.tasks,
                  trap: {
                    time: trapOptions.time,
                    start_day: trapOptions.day,
                    notification_channel_id: trapOptions.channel,
                  },
                },
              };

              axios
                .patch(`http://localhost:3500/users/${i.guildId}`, server)
                .then((response) => {
                  console.log(response.data, 'response');
                });

              return i.update({
                content: `You have selected:\nTime: ${
                  trapOptions.time
                } UTC\nNotification starts: ${
                  trapOptions.day
                }\nNotification will be send to: ${i.guild.channels.cache.get(
                  trapOptions.channel,
                )}`,
                components: [],
              });
            }
          })
          .catch((error) => {
            //console.log(error, 'error');

            if (error.response.status === 404) {
              // If it doesn't, create it
              const server = {
                serverId: i.guildId,
                serverName: i.guild.name,
                trap: {
                  time: trapOptions.time,
                  start_day: trapOptions.day,
                  notification_channel_id: trapOptions.channel,
                },
              };

              axios
                .post('http://localhost:3500/users', server)
                .then((response) => {
                  console.log(response.data, 'response');
                });

              return i.update({
                content: `You have selected:
                  Time: ${trapOptions.time} UTC
                  Notification starts: ${trapOptions.day}
                  Notification will be send to: ${i.guild.channels.cache.get(
                    trapOptions.channel,
                  )}`,
                components: [],
              });
            } else {
              return i.update(
                `Error: ${error.response.status} - ${error.response.statusText}`,
              );
            }
          });
        // const selection = i.values[0];
        // const channel = i.guild.channels.cache.get(selection);
        // await i.reply(`${i.user} has selected ${channel}!`);
      });

      collector.on('end', async () => {
        selectTime.setDisabled(true);
        selectDay.setDisabled(true);
        selectChannel.setDisabled(true);

        return;
      });

      channelCollector.on('end', async () => {
        selectChannel.setDisabled(true);

        return;
      });
    } catch (error) {
      console.log(error);
      return await interaction.editReply({
        content: 'There was an error while executing this command!',
        components: [],
      });
    }
  },
};
