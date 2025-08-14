import { Test, TestingModule } from '@nestjs/testing';

import { DiscordService } from './discord.service';
import { UsersService } from '../users/users.service';
import { UserMessagesService } from '../users/messages/messages.service';
import { ServersService } from '../servers/servers.service';
import { WikiSearchService } from '../wikis/wikisearch.service';
import { DiscordClientProvider } from './discord-client.provider';
import { CommandRegistry } from './command-registry';
import { InteractionHandler } from './interaction-handler';

describe('DiscordService', () => {
  let service: DiscordService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DiscordService,
        { provide: UsersService, useValue: {} },
        { provide: UserMessagesService, useValue: {} },
        { provide: ServersService, useValue: {} },
        { provide: WikiSearchService, useValue: {} },
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
