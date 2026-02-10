import {
  IsString,
  IsNumber,
  IsDateString,
  Min,
  Max,
  IsNotEmpty,
  ValidateNested,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

export class MeterTelemetryDto {
  @IsString()
  @IsNotEmpty()
  meterId: string;

  @IsNumber()
  @Min(0)
  kwhConsumedAc: number;

  @IsNumber()
  @Min(0)
  @Max(500)
  voltage: number;

  @IsDateString()
  timestamp: string;
}

export class VehicleTelemetryDto {
  @IsString()
  @IsNotEmpty()
  vehicleId: string;

  @IsNumber()
  @Min(0)
  @Max(100)
  soc: number;

  @IsNumber()
  @Min(0)
  kwhDeliveredDc: number;

  @IsNumber()
  @Min(-40)
  @Max(80)
  batteryTemp: number;

  @IsDateString()
  timestamp: string;
}

export class BatchMeterTelemetryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MeterTelemetryDto)
  data: MeterTelemetryDto[];
}

export class BatchVehicleTelemetryDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => VehicleTelemetryDto)
  data: VehicleTelemetryDto[];
}
