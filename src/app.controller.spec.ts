import { Test, TestingModule } from '@nestjs/testing';

import { AppController } from './app.controller';
import { AppService } from './app.service';
import { MetricsService } from './core/metrics/metrics.service';
import { DISCORD_HEALTH } from './discord/discord-health';

describe('AppController', () => {
  let appController: AppController;
  let discordHealth: { isReady: jest.Mock };

  beforeEach(async () => {
    discordHealth = { isReady: jest.fn().mockReturnValue(true) };

    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: MetricsService,
          useValue: { getMetrics: jest.fn().mockResolvedValue('') },
        },
        {
          provide: DISCORD_HEALTH,
          useValue: discordHealth,
        },
      ],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('root', () => {
    it('should return "Hello World!"', () => {
      expect(appController.getHello()).toBe('Hello World!');
    });
  });

  describe('ready', () => {
    it('returns ready when Discord is ready', () => {
      expect(appController.getReady()).toBe('ready');
    });

    it('throws when Discord is not ready', () => {
      discordHealth.isReady.mockReturnValue(false);

      expect(() => appController.getReady()).toThrow(
        'Discord client is not ready',
      );
    });
  });
});
