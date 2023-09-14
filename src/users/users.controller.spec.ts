import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import { UpdateUserDto } from './dto/update-user.dto';

describe('UsersController', () => {
  let controller: UsersController;
  let service: UsersService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [UsersService],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    service = module.get<UsersService>(UsersService);
  });

  describe('create', () => {
    it('should create a user', async () => {
      const user = {
        registeredAt: new Date(),
        serverName: 'Test Server',
        serverId: '1',
        subscription: 'free',
        tasks: [],
      };
      jest.spyOn(service, 'create').mockResolvedValue(user);

      const result = await controller.create(user);

      expect(result).toBe(user);
    });
  });

  describe('findAll', () => {
    it('should return an array of users', async () => {
      const users = [
        {
          registeredAt: new Date(),
          serverName: 'Test Server 1',
          serverId: '1',
          subscription: 'free',
          tasks: [],
        },
        {
          registeredAt: new Date(),
          serverName: 'Test Server 2',
          serverId: '2',
          subscription: 'premium',
          tasks: [],
        },
      ];

      jest.spyOn(service, 'findAll').mockImplementation(() => users as any);

      const result = await controller.findAll();

      expect(result).toBe(users);
    });
  });

  describe('findOne', () => {
    it('should return a user by id', async () => {
      const user = { id: '1' };
      jest.spyOn(service, 'findOne').mockResolvedValue(user as any);

      const result = await controller.findOne(user.id);

      expect(result).toContain(user);
    });
  });

  describe('update', () => {
    it('should update a user by serverId', async () => {
      const user = { serverId: '1' };
      const updateUserDto: UpdateUserDto = {
        serverId: '1',
        registeredAt: new Date(),
        serverName: 'Test of udapte',
        subscription: 'free',
        tasks: { welcome_channel_id: '1234' },
      };
      jest
        .spyOn(service, 'update')
        .mockResolvedValue({ ...user as any, ...updateUserDto });

      const result = await controller.update(user.serverId, updateUserDto);

      expect(result).toEqual({ ...user, ...updateUserDto });
    });
  });

  describe('remove', () => {
    it('should remove a user by id', async () => {
      const user = {
        serverId: '1',
      };
      jest.spyOn(service, 'remove').mockResolvedValue(user as any);

      const result = await controller.remove(user.serverId);

      expect(result).toBe(user);
    });
  });
});
