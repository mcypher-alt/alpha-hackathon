import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { json, urlencoded } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { ApiErrorFilter } from './errors.filter.js';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { bodyParser: false });
  app.use(json({ limit: '256kb' }));
  app.use(urlencoded({ extended: false, limit: '256kb' }));
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('Referrer-Policy', 'same-origin');
    res.setHeader('Cache-Control', 'no-store');
    next();
  });
  app.enableShutdownHooks();
  app.useGlobalFilters(new ApiErrorFilter());
  app.setGlobalPrefix('api');

  app.enableCors({
    origin: (process.env.CORS_ORIGIN || 'http://localhost:3000').split(','),
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Требование хакатона: Swagger / OpenAPI спецификация
  const config = new DocumentBuilder()
    .setTitle('Alfa Smart Credit Pipeline API')
    .setDescription('Цифровой кредитный конвейер для МСП (Альфа-Банк)')
    .setVersion('1.0')
    .addBearerAuth()
    .addTag('applications')
    .addTag('scoring')
    .addTag('news')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(Number(process.env.PORT || 4000), '0.0.0.0');
  console.log(`Backend is running on: http://localhost:4000`);
  console.log(`Swagger available at: http://localhost:4000/api/docs`);
}
bootstrap();
