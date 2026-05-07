import { MetricsService } from '../core/metrics/metrics.service';
import { ServersService } from '../servers/servers.service';
import { UserMessagesService } from '../users/messages/messages.service';
import { UsersService } from '../users/users.service';
import { CommandRegistry } from './command-registry';
import { InteractionHandler } from './interaction-handler';

describe('InteractionHandler', () => {
  function createHandler(commandName: string, execute = jest.fn()) {
    const commandRegistry = {
      get: jest.fn(
        () =>
          new Map([
            [
              commandName,
              {
                data: { name: commandName },
                execute,
              },
            ],
          ]),
      ),
    };
    const usersService = {
      findOrCreateUser: jest.fn().mockResolvedValue({
        discordUserId: 'user-1',
      }),
    };
    const serversService = {
      findOrCreateServer: jest.fn().mockResolvedValue({
        enabledChannels: ['enabled-channel'],
      }),
    };
    const metrics = {
      commandLatency: {
        startTimer: jest.fn(() => jest.fn()),
      },
    };
    const handler = new InteractionHandler(
      commandRegistry as unknown as CommandRegistry,
      usersService as unknown as UsersService,
      {} as UserMessagesService,
      serversService as unknown as ServersService,
      metrics as unknown as MetricsService,
    );
    return { handler, execute };
  }

  function createInteraction(commandName: string) {
    return {
      isChatInputCommand: jest.fn().mockReturnValue(true),
      isCommand: jest.fn().mockReturnValue(true),
      commandName,
      channelId: 'disabled-channel',
      guild: { id: 'guild-1', name: 'Guild' },
      user: { id: 'user-1' },
      reply: jest.fn().mockResolvedValue(undefined),
      replied: false,
      deferred: false,
    };
  }

  it('allows config commands outside enabled bot response channels', async () => {
    const { handler, execute } = createHandler('setbotchannels');
    const interaction = createInteraction('setbotchannels');

    await handler.handle(interaction as never);

    expect(interaction.reply).not.toHaveBeenCalledWith(
      expect.objectContaining({
        content: 'This command is not enabled in this channel.',
      }),
    );
    expect(execute).toHaveBeenCalled();
  });

  it('still blocks regular commands outside enabled bot response channels', async () => {
    const { handler, execute } = createHandler('ask');
    const interaction = createInteraction('ask');

    await handler.handle(interaction as never);

    expect(interaction.reply).toHaveBeenCalledWith({
      content: 'This command is not enabled in this channel.',
      ephemeral: true,
    });
    expect(execute).not.toHaveBeenCalled();
  });
});
