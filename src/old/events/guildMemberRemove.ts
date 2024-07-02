import axios from 'axios';
import { EmbedBuilder, GuildMember, TextChannel } from 'discord.js';

export async function goodbyeOldMember(member: GuildMember): Promise<void> {
  try {
    console.log(`Member left: ${member.user.username}`);

    // Fetch guild settings using environment variable for the API URL
    const guildSettings = await axios
      .get(`${process.env.API_URL}/guilds/${member.guild.id}`)
      .then((response) => response.data)
      .catch((error) => {
        console.error('Error fetching guild settings:', error);
        return null; // Return null to handle this error gracefully
      });

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
