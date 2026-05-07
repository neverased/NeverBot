import { PermissionFlagsBits } from 'discord.js';

jest.mock('../../decorators/discord-resilience.decorator', () => ({
  setDiscordResilience: jest.fn(),
}));

type PersonalityCommand = {
  execute: (
    interaction: ReturnType<typeof createInteraction>,
    executorProfile?: unknown,
    userMessagesService?: unknown,
    usersService?: {
      findOneByDiscordUserId: jest.Mock;
    },
  ) => Promise<void>;
};

function createInteraction(options: {
  targetUserId?: string;
  hasModeratorPermission?: boolean;
} = {}) {
  const targetUser = options.targetUserId
    ? {
        id: options.targetUserId,
        username: 'Target',
        displayAvatarURL: jest.fn().mockReturnValue('https://avatar.example/target.png'),
      }
    : null;
  return {
    deferReply: jest.fn().mockResolvedValue(undefined),
    editReply: jest.fn().mockResolvedValue(undefined),
    options: {
      getUser: jest.fn().mockReturnValue(targetUser),
    },
    user: {
      id: 'user-1',
      username: 'Alice',
      displayAvatarURL: jest.fn().mockReturnValue('https://avatar.example/alice.png'),
    },
    memberPermissions: {
      has: jest.fn((permission: bigint) => {
        return (
          options.hasModeratorPermission &&
          (permission === PermissionFlagsBits.Administrator ||
            permission === PermissionFlagsBits.ManageGuild)
        );
      }),
    },
  };
}

describe('/personality command', () => {
  let command: PersonalityCommand;
  let usersService: { findOneByDiscordUserId: jest.Mock };

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    usersService = {
      findOneByDiscordUserId: jest.fn(),
    };
    command = (await import('./personality')) as unknown as PersonalityCommand;
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('shows the caller their own personality snapshot ephemerally', async () => {
    usersService.findOneByDiscordUserId.mockResolvedValue({
      discordUserId: 'user-1',
      personalitySummary: 'Snapshot: dry and technical.',
      personalitySummaryStatus: 'ready',
    });
    const interaction = createInteraction();

    await command.execute(interaction, undefined, undefined, usersService);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(usersService.findOneByDiscordUserId).toHaveBeenCalledWith('user-1');
    expect(interaction.editReply).toHaveBeenCalledWith({
      embeds: [expect.objectContaining({ data: expect.any(Object) })],
    });
  });

  it('blocks viewing another user without moderator permissions', async () => {
    const interaction = createInteraction({ targetUserId: 'user-2' });

    await command.execute(interaction, undefined, undefined, usersService);

    expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
    expect(usersService.findOneByDiscordUserId).not.toHaveBeenCalled();
    expect(interaction.editReply).toHaveBeenCalledWith(
      'you can only view your own personality snapshot.',
    );
  });

  it('uses generation status instead of looking for error text in the summary', async () => {
    usersService.findOneByDiscordUserId.mockResolvedValue({
      discordUserId: 'user-1',
      personalitySummary: 'Snapshot: Existing useful summary',
      personalitySummaryStatus: 'error',
      personalitySummaryError: 'OpenAI down',
    });
    const interaction = createInteraction();

    await command.execute(interaction, undefined, undefined, usersService);

    expect(interaction.editReply).toHaveBeenCalledWith(
      'I tried to refresh that personality snapshot, but something broke. Last good snapshot is kept for chat context.',
    );
  });
});
