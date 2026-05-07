jest.mock('../../decorators/discord-resilience.decorator', () => ({
  setDiscordResilience: jest.fn(),
}));

export {};

type PrivacyExportCommand = {
  execute: (
    interaction: ReturnType<typeof createInteraction>,
    userProfile?: unknown,
    userMessagesService?: { findAllByUserId: jest.Mock },
  ) => Promise<void>;
};

function createInteraction() {
  return {
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    user: {
      id: 'user-1',
    },
  };
}

describe('/privacy-export command', () => {
  it('exports the caller profile and collected messages ephemerally', async () => {
    const command = (await import('./privacy-export')) as unknown as PrivacyExportCommand;
    const interaction = createInteraction();
    const userMessagesService = {
      findAllByUserId: jest.fn().mockResolvedValue([
        {
          messageId: 'message-1',
          content: 'hello',
        },
      ]),
    };

    await command.execute(
      interaction,
      { discordUserId: 'user-1' },
      userMessagesService,
    );

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(userMessagesService.findAllByUserId).toHaveBeenCalledWith('user-1');
    expect(interaction.editReply).toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'Here is your NeverBot data export.',
        files: [expect.any(Object)],
      }),
    );
  });
});
