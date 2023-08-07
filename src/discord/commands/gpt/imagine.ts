import { SlashCommandBuilder, AttachmentBuilder, EmbedBuilder } from 'discord.js';
const { Configuration, OpenAIApi } = require('openai');
import 'dotenv/config';
import { createCanvas, loadImage } from 'canvas';

const configuration = new Configuration({
  apiKey: process.env.GPT_KEY,
});

const openai = new OpenAIApi(configuration);

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('What do you want to imagine?')
    .addStringOption((option) =>
      option.setName('question').setDescription('Provide a prompt to imagine'),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const question = interaction.options.getString('question');

    //try catch block to catch errors
    try {
      //if no question is provided
      if (!question) {
        return await interaction.editReply(
          'Please provide a prompt to imagine!',
        );
      }
    } catch (error) {
      console.log(error);
      return await interaction.editReply(
        'There was an error while executing this command!',
      );
    }

    try {
      const completion = await openai.createImage({
        prompt: question,
        n: 1,
        size: '1024x1024',
      });

      console.log(completion.data);

      const canvas = createCanvas(1024, 1024);
        const ctx = canvas.getContext('2d');
        loadImage(completion.data.url).then((image) => {
            ctx.drawImage(image, 1024, 1024);
        }).catch((err) => {
            console.log(err);
        });
        
      const file = new AttachmentBuilder(
        canvas.toBuffer(),
        )

      await interaction.editReply({ files: [file] });
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
