jest.mock('../../decorators/discord-resilience.decorator', () => ({
  setDiscordResilience: jest.fn(),
}));

export {};

type PrivacyDeleteCommand = {
  execute: (
    interaction: ReturnType<typeof createInteraction>,
    userProfile?: unknown,
    userMessagesService?: unknown,
    usersService?: { removeByDiscordUserId: jest.Mock },
  ) => Promise<void>;
};

function createInteraction(confirm: string) {
  return {
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    options: {
      getString: jest.fn().mockReturnValue(confirm),
    },
    user: {
      id: 'user-1',
    },
  };
}

describe('/privacy-delete command', () => {
  it('requires an explicit confirmation string', async () => {
    const command = (await import('./privacy-delete')) as unknown as PrivacyDeleteCommand;
    const interaction = createInteraction('nope');
    const usersService = {
      removeByDiscordUserId: jest.fn(),
    };

    await command.execute(interaction, undefined, undefined, usersService);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(usersService.removeByDiscordUserId).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Data was not deleted. Run the command again with confirm=DELETE.',
    );
  });

  it('deletes the caller profile and collected messages through UsersService', async () => {
    const command = (await import('./privacy-delete')) as unknown as PrivacyDeleteCommand;
    const interaction = createInteraction('DELETE');
    const usersService = {
      removeByDiscordUserId: jest.fn().mockResolvedValue({ deletedCount: 1 }),
    };

    await command.execute(interaction, undefined, undefined, usersService);

    expect(usersService.removeByDiscordUserId).toHaveBeenCalledWith('user-1');
    expect(interaction.editReply).toHaveBeenCalledWith(
      'Your NeverBot user profile and collected messages were deleted.',
    );
  });
});
