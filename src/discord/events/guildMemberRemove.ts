//function to run when a member leaves the server

import axios from 'axios';
import { EmbedBuilder } from 'discord.js';

export async function goodbyeOldMember(member: any): Promise<void> {
  //send a goodbye message to the old member

  console.log(`Member left: ${member.user.username}`);

  const guildSettings = await axios
    .get(`http://localhost:3500/users/${member.guild.id}`)
    .then((response) => {
      return response.data;
    });

  const goodbyeEmbed = new EmbedBuilder()
    .setColor('#FF0000')
    .setTitle(`${member.user.username} just left the server! 👋`)
    .setDescription(
      `We're sorry to see you go. \nWe hope you enjoyed your stay. \n\nIf you ever want to come back, we'll be here waiting for you. \n\nUntil then, take care! 🍪🤖🎉`,
    )
    .setThumbnail(member.user.avatarURL())
    .setTimestamp();

  //send a message to the server's welcome channel
  //welcome_channel_id is located in response.data.tasks.welcome_channel_id
  member.guild.channels.cache
    .get(guildSettings.tasks.welcome_channel_id)
    .send({ embeds: [goodbyeEmbed] });
}
