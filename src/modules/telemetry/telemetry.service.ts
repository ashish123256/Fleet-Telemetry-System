/* eslint-disable prettier/prettier */
import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { MeterCurrentState, VehicleCurrentState } from './entities/current-state.entity';
import { MeterTelemetryHistory, VehicleTelemetryHistory } from './entities/telemetry-history.entity';
import { MeterTelemetryDto, VehicleTelemetryDto } from './dto/telemetry.dto';

@Injectable()
export class TelemetryService {
  private readonly logger = new Logger(TelemetryService.name);

  constructor(
    @InjectRepository(MeterCurrentState)
    private meterStateRepo: Repository<MeterCurrentState>,
    
    @InjectRepository(VehicleCurrentState)
    private vehicleStateRepo: Repository<VehicleCurrentState>,
    
    @InjectRepository(MeterTelemetryHistory)
    private meterHistoryRepo: Repository<MeterTelemetryHistory>,
    
    @InjectRepository(VehicleTelemetryHistory)
    private vehicleHistoryRepo: Repository<VehicleTelemetryHistory>,
    
    private dataSource: DataSource,
  ) {}

  async ingestMeterTelemetry(dto: MeterTelemetryDto): Promise<void> {
    const timestamp = new Date(dto.timestamp);

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`
          INSERT INTO meter_current_state (meter_id, kwh_consumed_ac, voltage, last_update)
          VALUES ($1, $2, $3, $4)
          ON CONFLICT (meter_id) 
          DO UPDATE SET 
            kwh_consumed_ac = EXCLUDED.kwh_consumed_ac,
            voltage = EXCLUDED.voltage,
            last_update = EXCLUDED.last_update
        `, [dto.meterId, dto.kwhConsumedAc, dto.voltage, timestamp]);

        await manager.query(`
          INSERT INTO meter_telemetry_history (meter_id, kwh_consumed_ac, voltage, timestamp)
          VALUES ($1, $2, $3, $4)
        `, [dto.meterId, dto.kwhConsumedAc, dto.voltage, timestamp]);
      });

      this.logger.debug(`Meter ${dto.meterId} telemetry ingested`);
    } catch (error) {
      this.logger.error(`Failed to ingest meter telemetry: ${(error as Error).message}`);
      throw error;
    }
  }

  async ingestVehicleTelemetry(dto: VehicleTelemetryDto): Promise<void> {
    const timestamp = new Date(dto.timestamp);

    try {
      await this.dataSource.transaction(async (manager) => {
        await manager.query(`
          INSERT INTO vehicle_current_state (vehicle_id, soc, kwh_delivered_dc, battery_temp, last_update)
          VALUES ($1, $2, $3, $4, $5)
          ON CONFLICT (vehicle_id) 
          DO UPDATE SET 
            soc = EXCLUDED.soc,
            kwh_delivered_dc = EXCLUDED.kwh_delivered_dc,
            battery_temp = EXCLUDED.battery_temp,
            last_update = EXCLUDED.last_update
        `, [dto.vehicleId, dto.soc, dto.kwhDeliveredDc, dto.batteryTemp, timestamp]);

        await manager.query(`
          INSERT INTO vehicle_telemetry_history (vehicle_id, soc, kwh_delivered_dc, battery_temp, timestamp)
          VALUES ($1, $2, $3, $4, $5)
        `, [dto.vehicleId, dto.soc, dto.kwhDeliveredDc, dto.batteryTemp, timestamp]);
      });

      this.logger.debug(`Vehicle ${dto.vehicleId} telemetry ingested`);
    } catch (error) {
      this.logger.error(`Failed to ingest vehicle telemetry: ${(error as Error).message}`);
      throw error;
    }
  }


   async batchIngestMeter(dtos: MeterTelemetryDto[]): Promise<void> {
    if (!dtos?.length) return;

    const start = Date.now();
    this.logger.log(`Batch meter ingest: ${dtos.length} records`);

    try {
      await this.dataSource.transaction(async (manager) => {
        for (const dto of dtos) {
          const ts = new Date(dto.timestamp);

          await manager.query(`
            INSERT INTO meter_current_state
              (meter_id, kwh_consumed_ac, voltage, last_update)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (meter_id)
            DO UPDATE SET
              kwh_consumed_ac = EXCLUDED.kwh_consumed_ac,
              voltage         = EXCLUDED.voltage,
              last_update     = EXCLUDED.last_update
          `, [dto.meterId, dto.kwhConsumedAc, dto.voltage, ts]);

          await manager.query(`
            INSERT INTO meter_telemetry_history
              (meter_id, kwh_consumed_ac, voltage, timestamp)
            VALUES ($1, $2, $3, $4)
          `, [dto.meterId, dto.kwhConsumedAc, dto.voltage, ts]);
        }
      });

      this.logger.log(`Batch done: ${dtos.length} records in ${Date.now() - start}ms`);
    } catch (error) {
      this.logger.error(`Batch meter failed:  ${(error as Error).message}`);
      throw error;
    }
  }

  async batchIngestVehicle(dtos: VehicleTelemetryDto[]): Promise<void> {
    if (!dtos?.length) return;

    const start = Date.now();
    this.logger.log(`Batch vehicle ingest: ${dtos.length} records`);

    try {
      await this.dataSource.transaction(async (manager) => {
        for (const dto of dtos) {
          const ts = new Date(dto.timestamp);

          await manager.query(`
            INSERT INTO vehicle_current_state
              (vehicle_id, soc, kwh_delivered_dc, battery_temp, last_update)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (vehicle_id)
            DO UPDATE SET
              soc              = EXCLUDED.soc,
              kwh_delivered_dc = EXCLUDED.kwh_delivered_dc,
              battery_temp     = EXCLUDED.battery_temp,
              last_update      = EXCLUDED.last_update
          `, [dto.vehicleId, dto.soc, dto.kwhDeliveredDc, dto.batteryTemp, ts]);

          await manager.query(`
            INSERT INTO vehicle_telemetry_history
              (vehicle_id, soc, kwh_delivered_dc, battery_temp, timestamp)
            VALUES ($1, $2, $3, $4, $5)
          `, [dto.vehicleId, dto.soc, dto.kwhDeliveredDc, dto.batteryTemp, ts]);
        }
      });

      this.logger.log(`Batch done: ${dtos.length} records in ${Date.now() - start}ms`);
    } catch (error) {
      this.logger.error(`Batch vehicle failed:  ${(error as Error).message}`);
      throw error;
    }
  }


  async getMeterState(meterId: string): Promise<MeterCurrentState> {
    return this.meterStateRepo.findOne({ where: { meterId } });
  }

  // Ek vehicle ka latest state (SoC, battery temp etc.)
  async getVehicleState(vehicleId: string): Promise<VehicleCurrentState> {
    return this.vehicleStateRepo.findOne({ where: { vehicleId } });
  }

  // Saare meters ka latest state
  async getAllMeterStates(): Promise<MeterCurrentState[]> {
    return this.meterStateRepo.find({ order: { lastUpdate: 'DESC' } });
  }

  // Saare vehicles ka latest state
  async getAllVehicleStates(): Promise<VehicleCurrentState[]> {
    return this.vehicleStateRepo.find({ order: { lastUpdate: 'DESC' } });
  }
}