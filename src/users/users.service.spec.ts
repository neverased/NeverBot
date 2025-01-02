import { getModelToken } from '@nestjs/mongoose';
import { Test, TestingModule } from '@nestjs/testing';

import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';


  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getModelToken(User.name), useValue: {} },
      ],
    }).compile();

    beforeEach(async () => {
      const module: TestingModule = await Test.createTestingModule({
        providers: [
          UsersService,
          {
            provide: getModelToken(User.name),
            useValue: {
              new: jest.fn().mockResolvedValue({}),
              constructor: jest.fn().mockResolvedValue({}),
              find: jest.fn().mockResolvedValue([]),
              findById: jest.fn().mockResolvedValue({}),
              create: jest.fn().mockResolvedValue({}),
              findOneAndUpdate: jest.fn().mockResolvedValue({}),
              findOneAndDelete: jest.fn().mockResolvedValue({}),
            },
          },
        ],
      }).compile();

      service = module.get<UsersService>(UsersService);
      userModel = module.get<Model<User>>(getModelToken(User.name));
    });

    it('should be defined', () => {
      expect(service).toBeDefined();
    });
  });