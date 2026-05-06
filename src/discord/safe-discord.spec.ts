import { Logger } from '@nestjs/common';
import { ChatInputCommandInteraction } from 'discord.js';

import { withSafeInteraction } from './safe-discord';

describe('withSafeInteraction', () => {
  it('does not retry initial interaction acknowledgements', async () => {
    const reply = jest.fn().mockRejectedValue(new Error('already acked'));
    const interaction = {
      reply,
    } as unknown as ChatInputCommandInteraction;
    const logger = { warn: jest.fn() } as unknown as Logger;

    const safe = withSafeInteraction(interaction, logger, {
      retries: 2,
      timeoutMs: 1000,
    });

    await expect(safe.reply({ content: 'nope' })).rejects.toThrow(
      'already acked',
    );
    expect(reply).toHaveBeenCalledTimes(1);
    expect(logger.warn).not.toHaveBeenCalled();
  });
});
