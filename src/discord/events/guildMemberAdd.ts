//function to run when a new member joins the server

import axios from 'axios';
import { EmbedBuilder, userMention } from 'discord.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GPT_KEY,
});

export async function welcomeNewMember(member: any): Promise<void> {
  //send a welcome message to the new member

  console.log(`New member joined: ${member.user.username}`);

  const guildSettings = await axios
    .get(`http://localhost:3500/users/${member.guild.id}`)
    .then((response) => {
      return response.data;
    });

  const mora = userMention('701709518668693617');

  const completion = await openai.chat.completions.create({
    model: 'gpt-3.5-turbo',
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
    max_tokens: 100,
    top_p: 1,
    frequency_penalty: 0,
    presence_penalty: 0,
  });

  console.log(completion.choices[0]);

  const welcomeEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle(`${member.user.username} just joined! 🎉`)
    .setDescription(completion.choices[0].message.content.toString())
    .setThumbnail(member.user.avatarURL())
    .setTimestamp();

  //send a message to the server's welcome channe
  //welcome_channel_id is located in response.data.tasks.welcome_channel_id
  member.guild.channels.cache
    .get(guildSettings.tasks.welcome_channel_id)
    .send({ embeds: [welcomeEmbed] });
}
