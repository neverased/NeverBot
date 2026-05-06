import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { MetricsService } from '../src/core/metrics/metrics.service';
import { DISCORD_HEALTH } from '../src/discord/discord-health';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [
        AppService,
        {
          provide: MetricsService,
          useValue: { getMetrics: jest.fn().mockResolvedValue('') },
        },
        {
          provide: DISCORD_HEALTH,
          useValue: { isReady: jest.fn().mockReturnValue(true) },
        },
      ],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  it('/api (GET)', () => {
    return request(app.getHttpServer())
      .get('/api')
      .expect(200)
      .expect('Hello World!');
  });
});
