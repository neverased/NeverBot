import { AttachmentBuilder } from 'discord.js';

import openai from '../../../shared/openai/client';

jest.mock('../../../shared/openai/client', () => ({
  __esModule: true,
  default: {
    images: {
      generate: jest.fn(),
    },
  },
}));

jest.mock('../../decorators/discord-resilience.decorator', () => ({
  setDiscordResilience: jest.fn(),
}));

const generateMock = openai.images.generate as jest.Mock;
type ImagineCommand = {
  execute: (interaction: ReturnType<typeof createInteraction>) => Promise<void>;
};

let command: ImagineCommand;

function createInteraction(prompt = 'a neon city') {
  return {
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    reply: jest.fn().mockResolvedValue(undefined),
    options: {
      getString: jest.fn().mockReturnValue(prompt),
    },
    user: { id: 'user-1' },
    guild: { id: 'guild-1' },
    deferred: true,
    replied: false,
  };
}

describe('/imagine command', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'log').mockImplementation(() => undefined);
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    command = (await import('./imagine')) as unknown as ImagineCommand;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('sends generated image bytes as a Discord attachment buffer', async () => {
    const imageBytes = Buffer.from('generated image bytes');
    const interaction = createInteraction();
    generateMock.mockResolvedValue({
      created: 1,
      data: [{ b64_json: imageBytes.toString('base64') }],
    });

    await command.execute(interaction);

    expect(generateMock).toHaveBeenCalledWith({
      model: 'gpt-image-1',
      prompt: 'a neon city',
      size: '1024x1024',
    });
    expect(interaction.editReply).toHaveBeenCalledWith({
      content: 'Prompt: a neon city',
      files: [expect.any(AttachmentBuilder)],
    });

    const attachment = interaction.editReply.mock.calls[0][0]
      .files[0] as AttachmentBuilder;
    expect(attachment.name).toBe('imagined.png');
    expect(Buffer.isBuffer(attachment.attachment)).toBe(true);
    expect(attachment.attachment).toEqual(imageBytes);
  });

  it('returns a structured error when OpenAI response has no image data', async () => {
    const interaction = createInteraction();
    generateMock.mockResolvedValue({ created: 1, data: [{}] });

    await command.execute(interaction);

    expect(interaction.editReply).toHaveBeenCalledWith(
      "couldn't generate that: Image data not found in API response (b64_json missing).",
    );
  });

  it('trims image prompts before calling OpenAI', async () => {
    const imageBytes = Buffer.from('generated image bytes');
    const interaction = createInteraction('  a neon city  ');
    generateMock.mockResolvedValue({
      created: 1,
      data: [{ b64_json: imageBytes.toString('base64') }],
    });

    await command.execute(interaction);

    expect(generateMock).toHaveBeenCalledWith({
      model: 'gpt-image-1',
      prompt: 'a neon city',
      size: '1024x1024',
    });
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Prompt: a neon city',
      }),
    );
  });

  it('rejects overly long image prompts before calling OpenAI', async () => {
    const interaction = createInteraction('x'.repeat(1601));

    await command.execute(interaction);

    expect(generateMock).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      'prompt is too long. keep it under 1600 characters.',
    );
  });
});
