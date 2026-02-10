/* eslint-disable prettier/prettier */
import { Controller, Post, Get, Body, Param, HttpCode, HttpStatus, Logger, NotFoundException } from '@nestjs/common';
import { TelemetryService } from './telemetry.service';
import { MeterTelemetryDto, VehicleTelemetryDto, BatchMeterTelemetryDto, BatchVehicleTelemetryDto } from './dto/telemetry.dto';

@Controller('v1/telemetry')
export class TelemetryController {
  private readonly logger = new Logger(TelemetryController.name);

   constructor(private readonly svc: TelemetryService) {}

 @Post('meter')
  @HttpCode(HttpStatus.ACCEPTED)   // 202 - Data accepted for processing
  async ingestMeter(@Body() dto: MeterTelemetryDto) {
    this.logger.log(`Meter ingested: ${dto.meterId}`);
    await this.svc.ingestMeterTelemetry(dto);
    return {
      success: true,
      message: 'Meter data ingested successfully',
      meterId: dto.meterId,
      timestamp: dto.timestamp
    };
  }

   @Post('vehicle')
  @HttpCode(HttpStatus.ACCEPTED)
  async ingestVehicle(@Body() dto: VehicleTelemetryDto) {
    this.logger.log(`Vehicle ingested: ${dto.vehicleId}`);
    await this.svc.ingestVehicleTelemetry(dto);
    return {
      success: true,
      message: 'Vehicle data ingested successfully',
      vehicleId: dto.vehicleId,
      timestamp: dto.timestamp
    };
  }

@Post('meter/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  async batchMeter(@Body() dto: BatchMeterTelemetryDto) {
    this.logger.log(`Batch meter: ${dto.data.length} records`);
    await this.svc.batchIngestMeter(dto.data);
    return {
      success: true,
      message: `${dto.data.length} meter records ingested`,
      count: dto.data.length
    };
  }

   @Post('vehicle/batch')
  @HttpCode(HttpStatus.ACCEPTED)
  async batchVehicle(@Body() dto: BatchVehicleTelemetryDto) {
    this.logger.log(`Batch vehicle: ${dto.data.length} records`);
    await this.svc.batchIngestVehicle(dto.data);
    return {
      success: true,
      message: `${dto.data.length} vehicle records ingested`,
      count: dto.data.length
    };
  }


  @Get('meter/:meterId/current')
  async getMeterState(@Param('meterId') meterId: string) {
    const state = await this.svc.getMeterState(meterId);
    if (!state) throw new NotFoundException(`Meter ${meterId} not found`);
    return { success: true, data: state };
  }

  @Get('vehicle/:vehicleId/current')
  async getVehicleState(@Param('vehicleId') vehicleId: string) {
    const state = await this.svc.getVehicleState(vehicleId);
    if (!state) throw new NotFoundException(`Vehicle ${vehicleId} not found`);
    return { success: true, data: state };
  }


  @Get('meters/current')
  async getAllMeters() {
    const states = await this.svc.getAllMeterStates();
    return {
      success: true,
      count: states.length,
      data: states
    };
  }
  @Get('vehicles/current')
  async getAllVehicles() {
    const states = await this.svc.getAllVehicleStates();
    return {
      success: true,
      count: states.length,
      data: states
    };
  }
}