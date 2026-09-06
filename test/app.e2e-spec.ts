import { INestApplication } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Test, TestingModule } from '@nestjs/testing';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import request from 'supertest';

import { AppController } from '../src/app.controller';
import { AppService } from '../src/app.service';
import { MetricsService } from '../src/core/metrics/metrics.service';
import { DISCORD_HEALTH } from '../src/discord/discord-health';
import { UpdateUserDto } from '../src/users/dto/update-user.dto';

describe('AppController (e2e)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [ThrottlerModule.forRoot([{ ttl: 60_000, limit: 2 }])],
      controllers: [AppController],
      providers: [
        AppService,
        { provide: APP_GUARD, useClass: ThrottlerGuard },
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

  it('enforces the global request limit with NestJS 12', async () => {
    await request(app.getHttpServer()).get('/api').expect(200);
    await request(app.getHttpServer()).get('/api').expect(200);
    await request(app.getHttpServer()).get('/api').expect(429);
  });

  it('generates the API documentation', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('NeverBot API').setVersion('1.0').build(),
    );
    expect(document.paths['/api/health'].get).toBeDefined();
  });

  it('preserves optional fields and validation in mapped update DTOs', async () => {
    expect(await validate(plainToInstance(UpdateUserDto, {}))).toEqual([]);
    const errors = await validate(
      plainToInstance(UpdateUserDto, { subscription: 123 }),
    );
    expect(errors).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ property: 'subscription' }),
      ]),
    );
  });
});
