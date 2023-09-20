import { SlashCommandBuilder } from 'discord.js';
import 'dotenv/config';
import axios from 'axios';
import fs from 'fs';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('What do you want to imagine?')
    .addStringOption((option) =>
      option.setName('prompt').setDescription('Provide a prompt to imagine'),
    ),
  async execute(interaction) {
    await interaction.deferReply();
    const question = await interaction.options.getString('prompt');

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
      console.log(question, 'question');
      //stablediffusion API call
      const request = await axios
        .post(
          'https://stablediffusionapi.com/api/v3/text2img',
          {
            key: process.env.STABLE_DIFFUSION_API_KEY,
            prompt: question,
            negative_prompt:
              '((out of frame)), ((extra fingers)), mutated hands, ((poorly drawn hands)), ((poorly drawn face)), (((mutation))), (((deformed))), (((tiling))), ((naked)), ((tile)), ((fleshpile)), ((ugly)), (((abstract))), blurry, ((bad anatomy)), ((bad proportions)), ((extra limbs)), cloned face, glitchy, ((extra breasts)), ((double torso)), ((extra arms)), ((extra hands)), ((mangled fingers)), ((missing breasts)), (missing lips), ((ugly face)), ((fat)), ((extra legs))',
            width: '512',
            height: '512',
            samples: '1',
            num_inference_steps: '20',
            safety_checker: 'yes',
            enhance_prompt: 'no',
            seed: null,
            guidance_scale: 7.5,
            multi_lingual: 'yes',
            panorama: 'no',
            self_attention: 'yes',
            upscale: 'no',
            embeddings_model: null,
            webhook: null,
            track_id: null,
          },
          {
            headers: {
              'Content-Type': 'application/json',
            },
          },
        )
        .catch((error) => {
          console.log(error.response.status);
          console.log(error.response.data);
          return interaction.editReply(error.message);
        });

      console.log(request.data);
      //extract image url from response
      const image_url = request.data.output[0];

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

      //check if the image is ready
      if (request.data.status == 'processing') {
        await interaction.editReply(
          'Imagine propmpt added to queue. Estimated time to complete: ' +
            parseInt(request.data.eta) +
            ' seconds',
        );

        const eta = parseInt(request.data.eta + 10) * 1000;
        console.log(eta, 'eta');

        //timeout to wait for the image to be ready
        setTimeout(async () => {
          const queue_request = await axios.post(
            request.data.fetch_result,
            {
              key: process.env.STABLE_DIFFUSION_API_KEY,
              redirect: 'follow',
            },
            {
              headers: {
                'Content-Type': 'application/json',
              },
            },
          );

          console.log(queue_request.data, 'queue_reqest');

          if (queue_request.data.status == 'failed') {
            return await interaction.editReply(
              'There was an error while executing this command!',
            );
          } else if (queue_request.data.status == 'processing') {
            await interaction.editReply(
              'Sorry, i need a few more seconds to imagine this prompt!',
            );

            setTimeout(async () => {
              const queue_request_double_check = await axios.post(
                request.data.fetch_result,
                {
                  key: process.env.STABLE_DIFFUSION_API_KEY,
                  redirect: 'follow',
                },
                {
                  headers: {
                    'Content-Type': 'application/json',
                  },
                },
              );

              if (
                queue_request.data.status == 'failed' ||
                queue_request.data.status == 'processing'
              ) {
                return await interaction.editReply(
                  'You beat me this time, even I am not able to imagine this. Good job! From now on, you are officially a weirdo!',
                );
              } else {
                await download_image(
                  queue_request_double_check.data.output[0],
                  'image_from_queue.png',
                );

                return await interaction.editReply({
                  content: 'Question: ' + question,
                  files: ['image_from_queue.png'],
                });
              }
            }, 20000);
          }

          //download image
          await download_image(
            queue_request.data.output[0],
            'image_from_queue.png',
          );

          return await interaction.editReply({
            content: 'Question: ' + question,
            files: ['image_from_queue.png'],
          });
        }, eta);
      } else {
        await download_image(image_url, 'image.png');

        await interaction.editReply({
          content: 'Question: ' + question,
          files: ['image.png'],
        });
      }
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
