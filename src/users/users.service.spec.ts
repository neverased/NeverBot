import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { UsersService } from './users.service';
import { User } from './entities/user.entity';


  describe('UsersService', () => {
    let service: UsersService;
    let userModel: Model<User>;

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