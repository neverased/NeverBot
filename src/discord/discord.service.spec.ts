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
  };
  let userMessagesService: { create: jest.Mock };
  let personalityService: { maybeRefreshPersonalitySummary: jest.Mock };
  let serversService: { findOrCreateServer: jest.Mock };

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

    const clientMock = {
      on: jest.fn(
        (event: string, handler: (...args: never[]) => Promise<void> | void) => {
          eventHandlers.set(event, handler);
          return clientMock;
        },
      ),
      commands: new Map(),
      user: { id: 'bot-1', username: 'Never' },
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
});
