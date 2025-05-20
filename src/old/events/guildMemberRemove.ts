import axios from 'axios';
import { EmbedBuilder, GuildMember, TextChannel } from 'discord.js';

export async function goodbyeOldMember(member: GuildMember): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:3500'; // Ensure API_URL is defined
  try {
    console.log(`Member left: ${member.user.username}`);

    let guildSettings;
    try {
      // Fetch guild settings using environment variable for the API URL
      const response = await axios.get(`${apiUrl}/guilds/${member.guild.id}`);
      guildSettings = response.data;
    } catch (apiError) {
      console.error(
        `Failed to fetch guild settings for ${member.guild.id}:`,
        apiError.message,
      );
      return; // Stop if guild settings can't be fetched
    }

    // Check for necessary guild settings
    if (
      !guildSettings ||
      !guildSettings.tasks ||
      !guildSettings.tasks.welcome_channel_id
    ) {
      console.error('Guild settings or welcome channel ID not found.');
      return;
    }

    // Create the goodbye message embed
    const goodbyeEmbed = new EmbedBuilder()
      .setColor('#FF0000')
      .setTitle(`${member.user.username} just left the server! 👋`)
      .setDescription(
        `We're sorry to see you go. \nWe hope you enjoyed your stay. \n\nIf you ever want to come back, we'll be here waiting for you. \n\nUntil then, take care! 🍪🤖🎉`,
      )
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    // Fetch the channel and send the goodbye message
    const channel = member.guild.channels.cache.get(
      guildSettings.tasks.welcome_channel_id,
    );
    if (!channel || !(channel instanceof TextChannel)) {
      console.error('Welcome channel not found or is not a text channel.');
      return;
    }

    await channel.send({ embeds: [goodbyeEmbed] });
  } catch (error) {
    console.error('Failed to send goodbye message:', error);
  }
}
