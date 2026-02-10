/* eslint-disable prettier/prettier */

import { NestFactory } from '@nestjs/core';
import { AppModule }   from './app.module';
import { Logger }      from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create(AppModule, {
    logger: ['log', 'error', 'warn', 'debug'],
  });


  app.setGlobalPrefix('api');

  // CORS enable karo
  app.enableCors({ origin: '*' });

  const port = process.env.PORT || 3000;
  await app.listen(port);

  // Startup messages
  logger.log('================================================');
  logger.log('  Fleet Telemetry System - STARTED');
  logger.log('================================================');
  logger.log(`Server:    http://localhost:${port}/api`);
  logger.log('');
  logger.log('INGESTION ENDPOINTS:');
  logger.log(`  POST   /api/v1/telemetry/meter           <- Smart Meter data`);
  logger.log(`  POST   /api/v1/telemetry/vehicle         <- EV Vehicle data`);
  logger.log(`  POST   /api/v1/telemetry/meter/batch     <- Bulk meter data`);
  logger.log(`  POST   /api/v1/telemetry/vehicle/batch   <- Bulk vehicle data`);
  logger.log('');
  logger.log('CURRENT STATE (HOT):');
  logger.log(`  GET    /api/v1/telemetry/meters/current`);
  logger.log(`  GET    /api/v1/telemetry/vehicles/current`);
  logger.log('');
  logger.log('ANALYTICS (REQUIREMENT D):');
  logger.log(`  GET    /api/v1/analytics/performance/:vehicleId  <- 24h report`);
  logger.log(`  GET    /api/v1/analytics/fleet/performance`);
  logger.log(`  GET    /api/v1/analytics/anomalies?threshold=85`);
  logger.log('================================================');
}

bootstrap();