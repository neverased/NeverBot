import 'dotenv/config';

import { AttachmentBuilder, SlashCommandBuilder } from 'discord.js';
import type { ImagesResponse } from 'openai/resources/images';

import openai from '../../../shared/openai/client';
import { getOpenAiFlowPolicy } from '../../../shared/openai/model-policy';
import { setDiscordResilience } from '../../decorators/discord-resilience.decorator';

const GENERATED_IMAGE_FILE_NAME = 'imagined.png';

interface GeneratedImage {
  base64: string;
  imageCount: number;
}

interface OpenAiErrorPayload {
  response?: {
    status?: number;
    data?: {
      error?: {
        message?: string;
      };
    };
  };
  message?: string;
}

class ImageGenerationResponseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ImageGenerationResponseError';
  }
}

function getGeneratedImage(response: ImagesResponse): GeneratedImage {
  const imageCount = Array.isArray(response.data) ? response.data.length : 0;
  const base64 = response.data?.[0]?.b64_json;

  if (!base64) {
    throw new ImageGenerationResponseError(
      'Image data not found in API response (b64_json missing).',
    );
  }

  return { base64, imageCount };
}

function getOpenAiErrorDetails(error: unknown): {
  status?: number;
  apiMessage?: string;
  message?: string;
} {
  const errorWithResponse = error as OpenAiErrorPayload;

  return {
    status: errorWithResponse?.response?.status,
    apiMessage: errorWithResponse?.response?.data?.error?.message,
    message: errorWithResponse?.message,
  };
}

function formatImageGenerationError(error: unknown): string {
  const { apiMessage, message } = getOpenAiErrorDetails(error);

  if (apiMessage) {
    return `couldn't generate that: ${apiMessage}`;
  }

  if (message) {
    return `couldn't generate that: ${message}`;
  }

  return "couldn't generate that image. maybe the prompt's too wild or something broke on my end?";
}

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

    try {
      console.log(
        `[Imagine] Start | user=${interaction.user?.id} guild=${interaction.guild?.id ?? 'DM'} question="${question}"`,
      );
      console.log('[Imagine] Calling OpenAI images.generate | size=1024x1024');
      const policy = getOpenAiFlowPolicy('image');
      const imageResponse = await openai.images.generate({
        model: policy.model,
        prompt: question,
        size: '1024x1024',
      });

      const image = getGeneratedImage(imageResponse);
      console.log(
        `[Imagine] OpenAI response received | images=${image.imageCount} hasB64=${Boolean(
          image.base64,
        )}`,
      );

      const imageBuffer = Buffer.from(image.base64, 'base64');
      const attachment = new AttachmentBuilder(imageBuffer, {
        name: GENERATED_IMAGE_FILE_NAME,
      });
      console.log(
        `[Imagine] Prepared image attachment | name=${GENERATED_IMAGE_FILE_NAME} sizeBytes=${imageBuffer.length}`,
      );

      await interaction.editReply({
        content: 'Prompt: ' + question,
        files: [attachment],
      });
      console.log(`[Imagine] Reply sent | elapsedMs=${Date.now() - startedAt}`);
    } catch (error) {
      const elapsed = Date.now() - startedAt;
      const { status, apiMessage, message } = getOpenAiErrorDetails(error);
      console.error(
        `[Imagine] Error | elapsedMs=${elapsed} status=${status ?? 'n/a'} message=${
          message ?? 'n/a'
        } details=${apiMessage ?? 'n/a'}`,
      );
      const errorMessage = formatImageGenerationError(error);

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
    }
  },
};
