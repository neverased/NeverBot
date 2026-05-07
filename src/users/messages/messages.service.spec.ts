import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { UserMessagesService } from './messages.service';
import { UserMessage } from './schemas/user-message.schema';

describe('UserMessagesService', () => {
  let service: UserMessagesService;
  let save: jest.Mock;
  let userMessageModel: jest.Mock & {
    deleteMany: jest.Mock;
  };

  beforeEach(async () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-05-07T10:00:00.000Z'));
    save = jest.fn().mockResolvedValue({});
    userMessageModel = jest.fn().mockImplementation((payload) => ({
      payload,
      save,
    })) as jest.Mock & { deleteMany: jest.Mock };
    userMessageModel.deleteMany = jest.fn().mockReturnValue({
      exec: jest.fn().mockResolvedValue({ deletedCount: 2 }),
    });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserMessagesService,
        { provide: getModelToken(UserMessage.name), useValue: userMessageModel },
      ],
    }).compile();

    service = module.get<UserMessagesService>(UserMessagesService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('sets a default expiry for raw collected messages', async () => {
    await service.create({
      userId: 'user-1',
      messageId: 'message-1',
      channelId: 'channel-1',
      guildId: 'guild-1',
      scopeType: 'guild',
      scopeId: 'guild-1',
      content: 'hello',
      timestamp: new Date('2026-05-07T10:00:00.000Z'),
    });

    expect(userMessageModel).toHaveBeenCalledWith(
      expect.objectContaining({
        expiresAt: new Date('2026-08-05T10:00:00.000Z'),
      }),
    );
    expect(save).toHaveBeenCalled();
  });

  it('can delete all raw messages for a user', async () => {
    const result = await service.removeAllByUserId('user-1');

    expect(userMessageModel.deleteMany).toHaveBeenCalledWith({
      userId: 'user-1',
    });
    expect(result).toEqual({ deletedCount: 2 });
  });
});
