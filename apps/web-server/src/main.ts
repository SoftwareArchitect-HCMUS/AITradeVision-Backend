import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';

/**
 * Bootstrap the web server
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  
  // Use WebSocket adapter (native WebSocket instead of Socket.IO)
  app.useWebSocketAdapter(new WsAdapter(app));
  
  // Enable CORS
  app.enableCors({
    origin: '*',
    methods: 'GET,POST,PUT,DELETE,OPTIONS',
    allowedHeaders: 'Content-Type, Authorization',
  });

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // Swagger configuration
  const config = new DocumentBuilder()
    .setTitle('Crypto Analytics Platform API')
    .setDescription('REST API for TradingView-like crypto analytics platform with financial news crawling and AI analysis')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        name: 'JWT',
        description: 'Enter JWT token',
        in: 'header',
      },
      'JWT-auth', // This name here is important for matching up with @ApiBearerAuth() in your controller!
    )
    .addTag('auth', 'Authentication endpoints')
    .addTag('market', 'Market data endpoints')
    .addTag('news', 'News endpoints')
    .addTag('ai', 'AI insights endpoints')
    .addServer('http://localhost:3000', 'Local development server')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
      tagsSorter: 'alpha',
      operationsSorter: 'alpha',
    },
    customSiteTitle: 'Crypto Analytics API Docs',
  });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`Web server is running on port ${port}`);
  console.log(`Swagger documentation available at http://localhost:${port}/api`);
}

bootstrap();

