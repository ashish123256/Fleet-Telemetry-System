/* eslint-disable prettier/prettier */


import { Module, ValidationPipe } from '@nestjs/common';
import { ConfigModule }           from '@nestjs/config';
import { TypeOrmModule }          from '@nestjs/typeorm';
import { APP_PIPE }               from '@nestjs/core';

import { dataSourceOptions }  from './database/data-source';
import { TelemetryModule }    from './modules/telemetry/telemetry.module';
import { AnalyticsModule }    from './modules/analytics/analytics.module';


@Module({
  imports: [
    // 1. Environment variables (.env file)
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    // 2. PostgreSQL database connection
    TypeOrmModule.forRoot(dataSourceOptions),

    // 3. Feature modules
    TelemetryModule,   // Ingestion endpoints
    AnalyticsModule,   // Analytics endpoints
  ],

  providers: [
    // Global Validation Pipe
    {
      provide: APP_PIPE,
      useValue: new ValidationPipe({
        whitelist: true,              // Extra fields ignore karo
        forbidNonWhitelisted: true,   // Unknown fields pe error do
        transform: true,              // Auto type conversion
        transformOptions: { enableImplicitConversion: true },
      }),
    },
  ],
})
export class AppModule {}