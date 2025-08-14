import { Test, TestingModule } from '@nestjs/testing';

import { DiscordService } from './discord.service';
import { UsersService } from '../users/users.service';
import { UserMessagesService } from '../users/messages/messages.service';
import { ServersService } from '../servers/servers.service';
import { WikiSearchService } from '../wikis/wikisearch.service';

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
      ],
    }).compile();

    service = module.get<DiscordService>(DiscordService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
