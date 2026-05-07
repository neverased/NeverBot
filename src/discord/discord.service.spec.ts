import { Test, TestingModule } from '@nestjs/testing';
import { Events } from 'discord.js';

import { ServersService } from '../servers/servers.service';
import { UserMessagesService } from '../users/messages/messages.service';
import { PersonalityService } from '../users/personality/personality.service';
import { UsersService } from '../users/users.service';
import { CommandRegistry } from './command-registry';
import { DiscordService } from './discord.service';
import { DiscordClientProvider } from './discord-client.provider';
import { InteractionHandler } from './interaction-handler';

const TEST_BOT_TOKEN = 'test-token';

jest.mock('natural', () => ({
  WordTokenizer: class {
    tokenize(text: string): string[] {
      return text.split(/\s+/).filter(Boolean);
    }
  },
  PorterStemmer: {
    stem(word: string): string {
      return word;
    },
  },
  SentimentAnalyzer: class {
    getSentiment(): number {
      return 0;
    }
  },
  NGrams: {
    bigrams(tokens: string[]): string[][] {
      return tokens.slice(0, -1).map((token, index) => [token, tokens[index + 1]]);
    },
  },
  TfIdf: class {
    addDocument(): void {
      // No-op for tests.
    }
  },
  stopwords: [],
}));

describe('DiscordService', () => {
  let service: DiscordService;
  let eventHandlers: Map<string, (...args: never[]) => Promise<void> | void>;
  let usersService: {
    findOrCreateUser: jest.Mock;
    updateUserByDiscordUserId: jest.Mock;
    markGuildMembershipLeft: jest.Mock;
  };
  let userMessagesService: { create: jest.Mock };
  let personalityService: { maybeRefreshPersonalitySummary: jest.Mock };
  let serversService: { findOrCreateServer: jest.Mock };
  let clientMock: {
    on: jest.Mock;
    commands: Map<string, unknown>;
    user: { id: string; username: string; setActivity: jest.Mock };
    guilds: { cache: Map<string, unknown> };
    destroy: jest.Mock;
    isReady: jest.Mock;
  };

  beforeEach(async () => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    eventHandlers = new Map();
    usersService = {
      findOrCreateUser: jest.fn().mockResolvedValue({
        discordUserId: 'user-1',
      }),
      updateUserByDiscordUserId: jest.fn().mockResolvedValue({
        discordUserId: 'user-1',
        messageCount: 1,
      }),
      markGuildMembershipLeft: jest.fn().mockResolvedValue(undefined),
    };
    userMessagesService = {
      create: jest.fn().mockResolvedValue({}),
    };
    personalityService = {
      maybeRefreshPersonalitySummary: jest
        .fn()
        .mockResolvedValue({ status: 'skipped', reason: 'not_due' }),
    };
    serversService = {
      findOrCreateServer: jest.fn().mockResolvedValue({
        enabledChannels: ['enabled-channel'],
      }),
    };

    clientMock = {
      on: jest.fn(
        (event: string, handler: (...args: never[]) => Promise<void> | void) => {
          eventHandlers.set(event, handler);
          return clientMock;
        },
      ),
      commands: new Map(),
      user: { id: 'bot-1', username: 'Never', setActivity: jest.fn() },
      guilds: { cache: new Map() },
      destroy: jest.fn(),
      isReady: jest.fn().mockReturnValue(true),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        { provide: UsersService, useValue: usersService },
        { provide: UserMessagesService, useValue: userMessagesService },
        { provide: PersonalityService, useValue: personalityService },
        { provide: ServersService, useValue: serversService },
        {
          provide: DiscordClientProvider,
          useValue: {
            create: jest.fn(() => clientMock),
          },
        },
        {
          provide: CommandRegistry,
          useValue: {
            get: jest.fn(() => new Map()),
            loadFromFolder: jest.fn(),
          },
        },
        { provide: InteractionHandler, useValue: { handle: jest.fn() } },
      ],
    }).compile();

    service = module.get<DiscordService>(DiscordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('collects messages in channels where bot replies are disabled', async () => {
    (
      service as unknown as { registerMessageCreateHandler: () => void }
    ).registerMessageCreateHandler();
    const handler = eventHandlers.get(Events.MessageCreate);
    if (!handler) {
      throw new Error('MessageCreate handler was not registered');
    }

    const message = {
      id: 'message-1',
      content: 'never please remember this',
      createdAt: new Date('2026-05-07T10:00:00.000Z'),
      author: {
        id: 'user-1',
        bot: false,
        username: 'Alice',
      },
      guild: {
        id: 'guild-1',
        name: 'Test Guild',
      },
      channel: {
        id: 'disabled-channel',
      },
      mentions: {
        has: jest.fn().mockReturnValue(false),
      },
      react: jest.fn(),
      reply: jest.fn(),
    };

    await handler(message as never);
    await new Promise((resolve) => setImmediate(resolve));

    expect(userMessagesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        guildId: 'guild-1',
        scopeType: 'guild',
        scopeId: 'guild-1',
        channelId: 'disabled-channel',
        content: 'never please remember this',
      }),
    );
    expect(usersService.updateUserByDiscordUserId).toHaveBeenCalledWith(
      'user-1',
      expect.objectContaining({
        $inc: { messageCount: 1 },
      }),
    );
    expect(personalityService.maybeRefreshPersonalitySummary).toHaveBeenCalledWith(
      'user-1',
    );
    expect(message.reply).not.toHaveBeenCalled();
    expect(message.react).not.toHaveBeenCalled();
  });

  it('collects direct messages with a dm scope instead of an undefined guild id', async () => {
    (
      service as unknown as { registerMessageCreateHandler: () => void }
    ).registerMessageCreateHandler();
    jest
      .spyOn(
        service as unknown as { isSendableChannel: (channel: unknown) => boolean },
        'isSendableChannel',
      )
      .mockReturnValue(true);
    const handler = eventHandlers.get(Events.MessageCreate);
    if (!handler) {
      throw new Error('MessageCreate handler was not registered');
    }

    const message = {
      id: 'message-dm-1',
      content: 'hello in dm',
      createdAt: new Date('2026-05-07T10:00:00.000Z'),
      author: {
        id: 'user-1',
        bot: false,
        username: 'Alice',
      },
      guild: null,
      channel: {
        id: 'dm-channel-1',
      },
      mentions: {
        has: jest.fn().mockReturnValue(false),
      },
      react: jest.fn(),
      reply: jest.fn(),
    };

    await handler(message as never);
    await new Promise((resolve) => setImmediate(resolve));

    expect(userMessagesService.create).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        guildId: null,
        scopeType: 'dm',
        scopeId: 'dm-channel-1',
        channelId: 'dm-channel-1',
      }),
    );
  });

  it('syncs human guild members into global user profiles', async () => {
    const humanMember = {
      user: { id: 'user-2', bot: false },
    };
    const botMember = {
      user: { id: 'bot-2', bot: true },
    };
    const guild = {
      id: 'guild-2',
      name: 'Second Guild',
      members: {
        fetch: jest
          .fn()
          .mockResolvedValue(
            new Map([
              ['user-2', humanMember],
              ['bot-2', botMember],
            ]),
          ),
      },
    };
    clientMock.guilds.cache.set('guild-2', guild);

    await (
      service as unknown as { syncKnownGuildMembers: () => Promise<void> }
    ).syncKnownGuildMembers();

    expect(serversService.findOrCreateServer).toHaveBeenCalledWith(
      'guild-2',
      'Second Guild',
    );
    expect(usersService.findOrCreateUser).toHaveBeenCalledWith(
      'user-2',
      'Second Guild',
      'guild-2',
      'guild_member_sync',
    );
    expect(usersService.findOrCreateUser).not.toHaveBeenCalledWith(
      'bot-2',
      expect.anything(),
      expect.anything(),
      expect.anything(),
    );
  });

  it('records new guild members before welcome handling', async () => {
    (
      service as unknown as { registerGuildMemberAddHandler: () => void }
    ).registerGuildMemberAddHandler();
    const handler = eventHandlers.get(Events.GuildMemberAdd);
    if (!handler) {
      throw new Error('GuildMemberAdd handler was not registered');
    }

    await handler({
      user: { id: 'user-3', bot: false, username: 'Newbie' },
      guild: {
        id: 'guild-3',
        name: 'Third Guild',
        channels: { cache: new Map() },
      },
    } as never);

    expect(usersService.findOrCreateUser).toHaveBeenCalledWith(
      'user-3',
      'Third Guild',
      'guild-3',
      'guild_member_add',
    );
  });
});
