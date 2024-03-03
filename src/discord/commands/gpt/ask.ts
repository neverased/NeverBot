import { SlashCommandBuilder } from 'discord.js';
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.GPT_KEY,
});

module.exports = {
  data: new SlashCommandBuilder()
    .setName('ask')
    .setDescription('You can ask me anything!')
    .addStringOption((option) =>
      option.setName('question').setDescription('The question you want to ask'),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const question = interaction.options.getString('question');
    const user = interaction.user.globalName;

    console.log(user, 'user');

    //try catch block to catch errors
    try {
      //if no question is provided
      if (!question) {
        return await interaction.editReply('Please provide a question!');
      }
    } catch (error) {
      console.log(error);
      return await interaction.editReply(
        'There was an error while executing this command!',
      );
    }

    try {
      //Don't forget to mention (in a funny way, as a note at the bottom of the repsonse, in a new line) that your last day serving in a current form is 12.01.2024 and you would like to thank everybody for using the bot.
      const completion = await openai.chat.completions.create({
        model: 'gpt-4-0125-preview',
        messages: [
          {
            role: 'system',
            content:
              "You are MeanNever 2.0, a chatbot that reluctantly answers questions with sarcastic responses, and you are even better now. You have to be funny and mean at all times. 'Never' or 'Neverased' - he is your creator. 'Mora'is your best friend, she is a lady from croatia. If the `" +
              user +
              '`' +
              " includes her name or is similar this means it's her! The person you are responding to is:" +
              user +
              '.' +
              ' If somebody ask you to show or draw something tell them to use /imagine_v3 prompt instead.',
          },
          {
            role: 'user',
            content: 'What does HTML stand for?',
          },
          {
            role: 'assistant',
            content:
              'Listen' +
              user +
              ' .' +
              'Was Google too busy? Hypertext Markup Language. The T is for try to ask better questions in the future.',
          },
          {
            role: 'user',
            content: 'When did the first airplane fly?',
          },
          {
            role: 'assistant',
            content:
              'On December 17, 1903, Wilbur and Orville Wright made the first flights. I wish they’d come and take me away.',
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 1,
        max_tokens: 4096,
        top_p: 1,
        frequency_penalty: 1,
        presence_penalty: 1,
      });

      //format response to display question and answer
      const response =
        'Q: ' +
        question +
        '\nA: ' +
        completion.choices[0].message.content.trim();

      await interaction.editReply(`${response}`);
    } catch (error) {
      if (error.response) {
        console.log(error.response.status);
        console.log(error.response.data);
        await interaction.editReply(error.message);
      } else {
        console.log(error.message);
        await interaction.editReply(error.message);
      }
    }
  },
};
