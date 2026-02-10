/* eslint-disable prettier/prettier */

import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TelemetryController } from './telemetry.controller';
import { TelemetryService }    from './telemetry.service';

// HOT table entities
import {
  MeterCurrentState,
  VehicleCurrentState,
  VehicleMeterMapping
} from './entities/current-state.entity';

// COLD table entities
import {
  MeterTelemetryHistory,
  VehicleTelemetryHistory
} from './entities/telemetry-history.entity';


@Module({
  imports: [
    TypeOrmModule.forFeature([
      // HOT data - current state tables
      MeterCurrentState,
      VehicleCurrentState,
      VehicleMeterMapping,
      // COLD data - history tables
      MeterTelemetryHistory,
      VehicleTelemetryHistory,
    ]),
  ],
  controllers: [TelemetryController],
  providers: [TelemetryService],
  exports: [TelemetryService],
})
export class TelemetryModule{}