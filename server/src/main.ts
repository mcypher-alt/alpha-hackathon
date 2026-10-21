import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { ValidationPipe } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: 'http://localhost:3000',
    credentials: true,
  });

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Требование хакатона: Swagger / OpenAPI спецификация
  const config = new DocumentBuilder()
    .setTitle('Alfa Smart Credit Pipeline API')
    .setDescription('Цифровой кредитный конвейер для МСП (Альфа-Банк)')
    .setVersion('1.0')
    .addTag('applications')
    .addTag('scoring')
    .addTag('news')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document);

  await app.listen(4000);
  console.log(`Backend is running on: http://localhost:4000`);
  console.log(`Swagger available at: http://localhost:4000/api/docs`);
}
bootstrap();