import axios from 'axios';
import {
  EmbedBuilder,
  GuildMember,
  TextChannel,
  userMention,
} from 'discord.js';

import openai from '../../utils/openai-client';

export async function welcomeNewMember(member: GuildMember): Promise<void> {
  const apiUrl = process.env.API_URL || 'http://localhost:3500';
  try {
    console.log(`New member joined: ${member.user.username}`);

    let guildSettings;
    try {
      const response = await axios.get(`${apiUrl}/users/${member.guild.id}`);
      guildSettings = response.data;
    } catch (apiError) {
      console.error(
        `Failed to fetch guild settings for ${member.guild.id}:`,
        apiError.message,
      );
      return;
    }

    if (
      !guildSettings ||
      !guildSettings.tasks ||
      !guildSettings.tasks.welcome_channel_id
    ) {
      console.error('Guild settings or welcome channel ID not found.');
      return;
    }

    const mora = userMention('701709518668693617');

    const completion = await openai.chat.completions.create({
      model: 'o3',
      messages: [
        {
          role: 'system',
          content:
            'You are MeanNever, a chatbot that answers questions with sarcastic or very funny responses. Every new sentence will be in a new line with \n prefix.',
        },
        {
          role: 'user',
          content: `Welcome ${member.user.username} to the server!`,
        },
        {
          role: 'assistant',
          content: `Hold onto your keyboard, folks! 🎉 \nWe've got a fresh face in town! \nWelcome, ${member.user.username} 🌟, the chosen one who dared to click 'Join'. \nPrepare for a wild ride of laughs, discussions, and the occasional virtual dance-off.\nDon't worry, our emojis are friendly, and our GIFs are well-trained.\nIf you're lost, just shout 'HELP' and our tech wizards will come to your rescue.`,
        },
        {
          role: 'user',
          content: `Give a warm welcome to @${member.user.username} \nIntroduce yourself in a short sentence and mention that '/help' is the command to get started or, you can always ask ${mora} !`,
        },
      ],
      temperature: 1,
      max_completion_tokens: 200,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0,
    });

    if (!completion.choices[0] || !completion.choices[0].message.content) {
      console.error('Failed to generate welcome message from OpenAI.');
      return;
    }

    const welcomeEmbed = new EmbedBuilder()
      .setColor('#00FF00')
      .setTitle(`${member.user.username} just joined! 🎉`)
      .setDescription(completion.choices[0].message.content.toString())
      .setThumbnail(member.user.displayAvatarURL())
      .setTimestamp();

    const channel = member.guild.channels.cache.get(
      guildSettings.tasks.welcome_channel_id,
    );
    if (!channel || !(channel instanceof TextChannel)) {
      console.error('Welcome channel not found or is not a text channel.');
      return;
    }

    await channel.send({ embeds: [welcomeEmbed] });
  } catch (error) {
    console.error('Failed to welcome new member:', error);
  }
}
