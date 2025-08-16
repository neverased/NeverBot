import 'dotenv/config';

// import axios from 'axios'; // No longer needed for b64_json
import { SlashCommandBuilder } from 'discord.js';
import * as fs from 'fs/promises';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

import openai from '../../../utils/openai-client';

module.exports = {
  data: new SlashCommandBuilder()
    .setName('imagine')
    .setDescription('What do you want to imagine?')
    .addStringOption((option) =>
      option.setName('question').setDescription('Provide a prompt to imagine'),
    ),
  async execute(interaction) {
    // Image generation can take a bit; allow longer timeout and a single retry
    setDiscordResilience(module.exports.execute, {
      timeoutMs: 45000,
      retries: 1,
    });
    const startedAt = Date.now();
    await interaction.deferReply();
    const question = interaction.options.getString('question');

    if (!question) {
      return await interaction.editReply('Please provide a prompt!');
    }

    const tempImagePath = 'imagined.png';

    try {
      console.log(
        `[Imagine] Start | user=${interaction.user?.id} guild=${interaction.guild?.id ?? 'DM'} question="${question}"`,
      );
      console.log(
        '[Imagine] Calling OpenAI images.generate | model=gpt-image-1 size=1024x1024',
      );
      const imageResponse = await openai.images.generate({
        model: 'gpt-image-1', // Using gpt-image-1
        prompt: question,
        // response_format: 'url', // Removed, assuming default or b64_json
        size: '1024x1024', // Keep size for now, adjust if model requires different
        // n: 1, // Default is 1, can be explicit if needed
      });

      // const image_url = image.data[0].url; // Old URL logic
      const imageCount = Array.isArray((imageResponse as any)?.data)
        ? (imageResponse as any).data.length
        : 0;
      const image_base64 = (imageResponse as any)?.data?.[0]?.b64_json; // New b64_json logic
      console.log(
        `[Imagine] OpenAI response received | images=${imageCount} hasB64=${Boolean(
          image_base64,
        )}`,
      );

      if (!image_base64) {
        throw new Error(
          'Image data not found in API response (b64_json missing).',
        );
      }

      // Removed download_image function as we are writing from base64
      // const download_image = async (
      //   url: string,
      //   image_path: string,
      // ): Promise<void> => {
      //   const response = await axios({
      //     url,
      //     responseType: 'arraybuffer',
      //   });
      //   await fs.writeFile(image_path, response.data);
      // };

      // await download_image(image_url, tempImagePath); // Old download call

      // Decode base64 and write to file
      const image_bytes = Buffer.from(image_base64, 'base64');
      await fs.writeFile(tempImagePath, image_bytes);
      console.log(
        `[Imagine] Wrote image | path=${tempImagePath} sizeBytes=${image_bytes.length}`,
      );

      await interaction.editReply({
        content: 'Prompt: ' + question,
        files: [tempImagePath],
      });
      console.log(`[Imagine] Reply sent | elapsedMs=${Date.now() - startedAt}`);
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      // Try to surface OpenAI API details when present
      const status = (error as any)?.response?.status;
      const apiMsg = (error as any)?.response?.data?.error?.message;
      console.error(
        `[Imagine] Error | elapsedMs=${elapsed} status=${status ?? 'n/a'} message=${
          (error as Error)?.message
        } details=${apiMsg ?? 'n/a'}`,
      );
      let errorMessage =
        'Sorry, I ran into a problem trying to imagine that. Is the prompt too wild?';
      if (
        error.response &&
        error.response.data &&
        error.response.data.error &&
        error.response.data.error.message
      ) {
        errorMessage = `Sorry, I couldn't imagine that: ${error.response.data.error.message}`;
      } else if (error.message) {
        errorMessage = `Sorry, I couldn't imagine that: ${error.message}`;
      }

      if (interaction.replied || interaction.deferred) {
        await interaction
          .editReply(errorMessage)
          .catch((e) =>
            console.error('Error sending follow-up error message:', e),
          );
      } else {
        // This case should ideally not happen if we deferReply, but as a fallback
        await interaction
          .reply(errorMessage)
          .catch((e) => console.error('Error sending initial error reply:', e));
      }
    } finally {
      try {
        await fs.unlink(tempImagePath);
        console.log(`[Imagine] Cleaned up | deleted ${tempImagePath}`);
      } catch (unlinkError) {
        // Log only if the error is not ENOENT (file not found), as it might not have been created
        if (unlinkError.code !== 'ENOENT') {
          console.error(
            `Failed to delete temporary image ${tempImagePath}:`,
            unlinkError,
          );
        }
      }
    }
  },
};
