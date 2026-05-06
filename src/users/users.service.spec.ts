import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { User } from './schemas/users.schema';
import { UsersService } from './users.service';

describe('UsersService', () => {
  let service: UsersService;
  let usersModel: { findOneAndUpdate: jest.Mock };
  let exec: jest.Mock;

  beforeEach(async () => {
    exec = jest.fn().mockResolvedValue(null);
    usersModel = {
      findOneAndUpdate: jest.fn().mockReturnValue({ exec }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: usersModel },
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
});
