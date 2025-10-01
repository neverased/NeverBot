import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { HttpExceptionFilter } from './core/filters/http-exception.filter';
import { LoggingInterceptor } from './core/interceptors/logging.interceptor';
import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  app.setGlobalPrefix('api');
  app.use((req: Request, res: Response, next: NextFunction) => {
    const rid =
      (req?.headers?.['x-request-id'] as string | undefined) || randomUUID();
    res.setHeader('x-request-id', rid);
    if (req && req.headers) {
      (req.headers as Record<string, string>)['x-request-id'] = rid;
    }
    next();
  });
  app.use(helmet());
  if (process.env.NODE_ENV === 'production') {
    const allowed = (process.env.ALLOWED_ORIGINS || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    app.enableCors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true);
        if (allowed.length === 0 || allowed.includes(origin))
          return cb(null, true);
        return cb(new Error('Not allowed by CORS'), false);
      },
      credentials: true,
    });
  } else {
    app.enableCors();
  }
  app.enableShutdownHooks();
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: false,
    }),
  );
  app.useGlobalFilters(new HttpExceptionFilter());
  app.useGlobalInterceptors(new LoggingInterceptor());

  if (process.env.NODE_ENV !== 'production') {
    const config = new DocumentBuilder()
      .setTitle('NeverBot API')
      .setDescription('NeverBot API')
      .setVersion('1.0')
      .build();
    const document = SwaggerModule.createDocument(app, config);
    SwaggerModule.setup('api/docs', app, document);
  }

  const port = parseInt(process.env.PORT ?? '3500', 10);
  await app.listen(port);
}
bootstrap();
