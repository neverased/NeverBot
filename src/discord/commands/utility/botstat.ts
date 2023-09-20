//slash command to display bot stats and server stats
import axios from 'axios';
import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';

//import os-utils to get system stats
import os from 'os-utils';

const toHHMMSS = (secs) => {
  const sec_num = parseInt(secs, 10);
  const hours = Math.floor(sec_num / 3600);
  const minutes = Math.floor(sec_num / 60) % 60;
  const seconds = sec_num % 60;

  return [hours, minutes, seconds]
    .map((v) => (v < 10 ? '0' + v : v))
    .filter((v, i) => v !== '00' || i > 0)
    .join(':');
};

module.exports = {
  data: new SlashCommandBuilder()
    .setName('botstat')
    .setDescription('Display bot stats and server stats'),
  async execute(interaction) {
    await interaction.deferReply();

    let dbConnection: string = '';

    await axios
      .get('http://localhost:3500/')
      .then((response) => {
        if (response.status === 200) {
          dbConnection = 'Connected and Healthy';
        } else {
          dbConnection = 'Not Connected';
        }
      })
      .catch((error) => {
        console.log(error, 'error');
        dbConnection = 'Not Connected';
      });

    const botstatEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Bot Stats`)
      .setDescription(
        `Bot is in ${interaction.client.guilds.cache.size} servers`,
      )
      .addFields(
        { name: 'Platofrm', value: `${os.platform()}` },
        { name: 'Database', value: `${dbConnection}` },
        {
          name: 'CPU Usage',
          value: `${parseFloat(os.loadavg(5)).toFixed(2)}%`,
        },
        { name: 'CPU Cores', value: `${os.cpuCount()}` },
        { name: 'Free Memory', value: `${parseInt(os.freemem())}MB` },
        { name: 'Total Memory', value: `${os.totalmem()}MB` },
        { name: 'System Uptime', value: `${toHHMMSS(os.sysUptime())}` },
        { name: 'Process Uptime', value: `${toHHMMSS(os.processUptime())}` },
      )
      .setThumbnail(interaction.client.user.avatarURL())
      .setTimestamp();
    await interaction.editReply({ embeds: [botstatEmbed] });
  },
};
