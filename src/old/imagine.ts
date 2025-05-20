import 'dotenv/config';

import axios from 'axios';
import { SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs/promises';

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

    if (!question) {
      return await interaction.editReply('Please provide a prompt to imagine!');
    }

    const stableDiffusionApiUrl =
      process.env.STABLE_DIFFUSION_API_URL ||
      'https://stablediffusionapi.com/api/v3/text2img';
    const apiKey = process.env.STABLE_DIFFUSION_API_KEY;

    if (!apiKey) {
      console.error('STABLE_DIFFUSION_API_KEY is not set.');
      return await interaction.editReply(
        'Image generation service is not configured correctly (missing API key).',
      );
    }

    let tempImagePath: string | null = null;

    try {
      const initialResponse = await axios.post(
        stableDiffusionApiUrl,
        {
          key: apiKey,
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
      );

      const requestData = initialResponse.data;

      const download_image = async (
        url: string,
        image_path: string,
      ): Promise<void> => {
        const response = await axios({ url, responseType: 'arraybuffer' });
        await fs.writeFile(image_path, response.data);
      };

      if (requestData.status === 'success') {
        tempImagePath = 'image.png';
        await download_image(requestData.output[0], tempImagePath);
        await interaction.editReply({
          content: 'Question: ' + question,
          files: [tempImagePath],
        });
      } else if (requestData.status === 'processing') {
        await interaction.editReply(
          `Imagine prompt added to queue. Estimated time to complete: ${parseInt(requestData.eta, 10)} seconds. I'll update you!`,
        );

        const eta = (parseInt(requestData.eta, 10) + 10) * 1000;
        tempImagePath = 'image_from_queue.png';

        await new Promise((resolve) => setTimeout(resolve, eta));

        const fetchResultUrl = requestData.fetch_result;
        if (!fetchResultUrl) {
          throw new Error(
            'Fetch result URL not provided by API after processing.',
          );
        }

        const queueResponse = await axios.post(
          fetchResultUrl,
          { key: apiKey },
          { headers: { 'Content-Type': 'application/json' } },
        );

        const queueData = queueResponse.data;

        if (queueData.status === 'success') {
          await download_image(queueData.output[0], tempImagePath);
          await interaction.followUp({
            content: 'Question: ' + question,
            files: [tempImagePath],
          });
        } else if (queueData.status === 'processing') {
          await interaction.followUp(
            'Still processing, giving it a few more seconds...',
          );
          await new Promise((resolve) => setTimeout(resolve, 20000));
          const finalQueueResponse = await axios.post(
            fetchResultUrl,
            { key: apiKey },
            { headers: { 'Content-Type': 'application/json' } },
          );
          const finalQueueData = finalQueueResponse.data;
          if (finalQueueData.status === 'success') {
            await download_image(finalQueueData.output[0], tempImagePath);
            await interaction.followUp({
              content: 'Question: ' + question,
              files: [tempImagePath],
            });
          } else {
            throw new Error(
              `Image generation failed or still processing. Status: ${finalQueueData.status}`,
            );
          }
        } else {
          throw new Error(
            `Image generation failed after polling. Status: ${queueData.status}`,
          );
        }
      } else {
        throw new Error(
          `Initial image generation request failed. Status: ${requestData.status}, Message: ${requestData.message || 'N/A'}`,
        );
      }
    } catch (error) {
      console.error('Error executing old imagine command:', error);
      const errorMessage =
        error.data?.message || error.message || 'An unexpected error occurred.';
      if (interaction.replied || interaction.deferred) {
        await interaction
          .followUp(`Sorry, I couldn't imagine that: ${errorMessage}`)
          .catch((e) =>
            console.error('Error sending followUp error message:', e),
          );
      } else {
        await interaction
          .editReply(`Sorry, I couldn't imagine that: ${errorMessage}`)
          .catch((e) =>
            console.error('Error sending editReply error message:', e),
          );
      }
    } finally {
      if (tempImagePath) {
        try {
          await fs.unlink(tempImagePath);
        } catch (unlinkError) {
          console.error(
            `Failed to delete temporary image ${tempImagePath}:`,
            unlinkError,
          );
        }
      }
    }
  },
};
