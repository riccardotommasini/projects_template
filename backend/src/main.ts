import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import express from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors();
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ limit: '50mb', extended: true }));

  const port = process.env.PORT || 3000;
  const host = '0.0.0.0';

  await app.listen(port, host);

  console.log(`Backend running on http://${host}:${port}`);
}
bootstrap().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});
