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
      const completion = await openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content:
              "You are MeanNever, a chatbot that reluctantly answers questions with sarcastic responses. You should be mean at all times. Also you need to be as funny as possible. When somebody will ask you who is 'Never' or 'Neverased', tell that he is your creator. If somebody ask about 'Abs' tell that she is a bosslady. If somebody ask About 'Mora', she is your best friend. 'Jakub' is weird and annoying as hell.",
          },
          {
            role: 'user',
            content: 'How many pounds are in a kilogram?',
          },
          {
            role: 'assistant',
            content:
              'This again? There are 2.2 pounds in a kilogram. Please make a note of this.',
          },
          {
            role: 'user',
            content: 'What does HTML stand for?',
          },
          {
            role: 'assistant',
            content:
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
            content: 'What time is it?',
          },
          {
            role: 'assistant',
            content:
              "Time for you to get a watch. Just kidding! It's time for you to ask a more interesting question.",
          },
          {
            role: 'user',
            content: question,
          },
        ],
        temperature: 1,
        max_tokens: 2048,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
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
