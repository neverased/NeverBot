import { Test, TestingModule } from '@nestjs/testing';

import { ServersService } from '../servers/servers.service';
import { UserMessagesService } from '../users/messages/messages.service';
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

  beforeEach(async () => {
    process.env.BOT_TOKEN = TEST_BOT_TOKEN;
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        { provide: UsersService, useValue: {} },
        { provide: UserMessagesService, useValue: {} },
        { provide: ServersService, useValue: {} },
        {
          provide: DiscordClientProvider,
          useValue: {
            create: jest.fn(() => ({ on: jest.fn(), commands: new Map() })),
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
});
