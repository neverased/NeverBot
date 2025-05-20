//slash command to display bot stats and server stats
import axios from 'axios';
import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
//import os-utils to get system stats
import * as os from 'os';

const toHHMMSS = (secs: number) => {
  const sec_num = parseInt(secs.toString(), 10);
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

    let dbConnection: string = 'Not Connected';
    const apiUrl = process.env.API_URL || 'http://localhost:3500/';

    try {
      const response = await axios.get(apiUrl);
      if (response.status === 200) {
        dbConnection = 'Connected and Healthy';
      }
    } catch (error) {
      console.log(`Error checking API status at ${apiUrl}:`, error.message);
    }

    const loadAvgs = os.loadavg();
    const cpuUsage = loadAvgs[0].toFixed(2);

    const botstatEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`Bot Stats`)
      .setDescription(
        `Bot is in ${interaction.client.guilds.cache.size} servers`,
      )
      .addFields(
        { name: 'Platform', value: `${os.platform()}` },
        { name: 'Database', value: `${dbConnection}` },
        {
          name: 'CPU Usage (1 min avg)',
          value: `${cpuUsage}%`,
        },
        // show the number of CPU cores
        { name: 'CPU Cores', value: `${os.cpus().length}` },

        {
          name: 'Free Memory',
          value: `${(os.freemem() / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        },
        {
          name: 'Total Memory',
          value: `${(os.totalmem() / (1024 * 1024 * 1024)).toFixed(2)} GB`,
        },
        { name: 'System Uptime', value: `${toHHMMSS(os.uptime())}` },
      )
      .setThumbnail(interaction.client.user.avatarURL())
      .setTimestamp();
    await interaction.editReply({ embeds: [botstatEmbed] });
  },
};
