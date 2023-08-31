import { SlashCommandBuilder } from 'discord.js';
import axios, { Axios } from 'axios';

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

    await axios
      .get(`http://localhost:3500/users/${interaction.guildId}`)
      .then((response) => {
        //console.log(response, 'response');

        if (response.data.statusCode != 404) {
          // If it does, update it
          const server = {
            tasks: {
              welcome_channel_id: interaction.options.getChannel('welcome').id,
            },
          };

          axios
            .patch(`http://localhost:3500/users/${interaction.guildId}`, server)
            .then((response) => {
              console.log(response.data, 'response');
            });

          return interaction.editReply(
            `Welcome channel was set to ${interaction.options.getChannel(
              'welcome',
            )}.`,
          );
        }
      })
      .catch((error) => {
        //console.log(error, 'error');

        if (error.response.status === 404) {
          // If it doesn't, create it
          const server = {
            serverId: interaction.guildId,
            serverName: interaction.guild.name,
            tasks: {
              welcome_channel_id: interaction.options.getChannel('welcome').id,
            },
          };

          axios.post('http://localhost:3500/users', server).then((response) => {
            console.log(response.data, 'response');
          });

          return interaction.editReply(
            `User added to database and welcome channel was set to ${interaction.options.getChannel(
              'welcome',
            )}.`,
          );
        }
      });
  },
};
