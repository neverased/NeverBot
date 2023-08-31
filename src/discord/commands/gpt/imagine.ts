import {
  SlashCommandBuilder,
  AttachmentBuilder,
  EmbedBuilder,
} from 'discord.js';
const OpenAI = require('openai');
import 'dotenv/config';
import axios from 'axios';
const fs = require('fs');

const openai = new OpenAI({
  apiKey: process.env.GPT_KEY,
});

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
      const completion = await openai.images.generate({
        prompt: question,
        n: 1,
        size: '1024x1024',
      });

      console.log(completion.data[0].url.toString());

      const link = completion.data[0].url.toString();

      const download_image = (url, image_path) =>
        axios({
          url,
          responseType: 'stream',
        }).then(
          (response) =>
            new Promise<void>((resolve, reject) => {
              response.data
                .pipe(fs.createWriteStream(image_path))
                .on('finish', () => resolve())
                .on('error', (e) => reject(e));
            }),
        );

      await download_image(link, 'image.png');

      await interaction.editReply({
        files: ['image.png'],
      });
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
