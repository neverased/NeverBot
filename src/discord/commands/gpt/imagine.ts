import 'dotenv/config';

import axios from 'axios';
import { SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs';
import OpenAI from 'openai';

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
        return await interaction.editReply('Please provide a prompt!');
      }
    } catch (error) {
      console.log(error);
      return await interaction.editReply(
        'There was an error while executing this command!',
      );
    }

    try {
      const image = await openai.images.generate({
        model: 'dall-e-3',
        prompt: question,
        response_format: 'url',
        size: '1024x1024',
      });

      //console.log(image.data, 'image');

      const image_url = image.data[0].url;

      //console.log(image_url, 'image_url');

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

      await download_image(image_url, 'imagined.png');

      await interaction.editReply({
        content: 'Prompt: ' + question,
        files: ['imagined.png'],
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
