import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { UserMessagesService } from './messages/messages.service';
import { User } from './schemas/users.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let usersModel: {
    findOneAndUpdate: jest.Mock;
    updateOne: jest.Mock;
    deleteOne: jest.Mock;
  };
  let userMessagesService: { removeAllByUserId: jest.Mock };
  let exec: jest.Mock;

  beforeEach(async () => {
    exec = jest.fn().mockResolvedValue(null);
    usersModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec }),
      updateOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ matchedCount: 1 }),
      }),
      deleteOne: jest.fn().mockReturnValue({
        exec: jest.fn().mockResolvedValue({ deletedCount: 1 }),
      }),
    };
    userMessagesService = {
      removeAllByUserId: jest.fn().mockResolvedValue({ deletedCount: 3 }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: usersModel },
        { provide: UserMessagesService, useValue: userMessagesService },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('wraps plain DTO updates in $set', async () => {
    await service.updateUserByDiscordUserId('user-1', {
      messageCount: 3,
    });

    expect(usersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { discordUserId: 'user-1' },
      { $set: { messageCount: 3 } },
      { new: true },
    );
    expect(exec).toHaveBeenCalled();
  });

  it('passes Mongo update operators through without nesting them in $set', async () => {
    const update = {
      $set: { lastSeen: new Date('2026-05-06T12:00:00.000Z') },
      $inc: { messageCount: 1 },
      $push: {
        sentimentHistory: {
          $each: [{ sentiment: 'neutral', score: 0, timestamp: new Date() }],
          $slice: -100,
        },
      },
    };

    await service.updateUserByDiscordUserId('user-1', update);

    expect(usersModel.findOneAndUpdate).toHaveBeenCalledWith(
      { discordUserId: 'user-1' },
      update,
      { new: true },
    );
  });

  it('adds a guild membership when a global user joins another guild', async () => {
    const firstExec = jest.fn().mockResolvedValue({ matchedCount: 0 });
    const secondExec = jest.fn().mockResolvedValue({ matchedCount: 1 });
    usersModel.updateOne
      .mockReturnValueOnce({ exec: firstExec })
      .mockReturnValueOnce({ exec: secondExec });

    await service.rememberGuildMembership(
      'user-1',
      'guild-2',
      'Second Guild',
      'guild_member_sync',
    );

    expect(usersModel.updateOne).toHaveBeenNthCalledWith(
      1,
      {
        discordUserId: 'user-1',
        'guildMemberships.guildId': 'guild-2',
      },
      expect.objectContaining({
        $set: expect.objectContaining({
          serverId: 'guild-2',
          serverName: 'Second Guild',
          'guildMemberships.$.source': 'guild_member_sync',
        }),
      }),
    );
    expect(usersModel.updateOne).toHaveBeenNthCalledWith(
      2,
      { discordUserId: 'user-1' },
      expect.objectContaining({
        $push: {
          guildMemberships: expect.objectContaining({
            guildId: 'guild-2',
            guildName: 'Second Guild',
            source: 'guild_member_sync',
          }),
        },
      }),
    );
  });

  it('removes raw messages when deleting a user', async () => {
    const result = await service.removeByDiscordUserId('user-1');

    expect(userMessagesService.removeAllByUserId).toHaveBeenCalledWith('user-1');
    expect(usersModel.deleteOne).toHaveBeenCalledWith({
      discordUserId: 'user-1',
    });
    expect(result).toEqual({ deletedCount: 1 });
  });
});
