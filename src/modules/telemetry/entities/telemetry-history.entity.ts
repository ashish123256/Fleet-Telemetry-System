/* eslint-disable prettier/prettier */
import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('meter_telemetry_history')
@Index(['meterId', 'timestamp'])    // Composite index - analytics ke liye
@Index(['timestamp'])               // Time range queries ke liye
export class MeterTelemetryHistory {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;


  @Column({ name: 'meter_id', type: 'varchar', length: 50 })
  meterId: string;

  // AC energy consumed at this specific minute
  @Column({ name: 'kwh_consumed_ac', type: 'decimal', precision: 10, scale: 3 })
  kwhConsumedAc: number;

  // Voltage at this specific minute
  @Column({ type: 'decimal', precision: 6, scale: 2 })
  voltage: number;

  // Exact timestamp of the reading
 
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}



// ----------------------------------------------------------------
@Entity('vehicle_telemetry_history')
@Index(['vehicleId', 'timestamp'])  // Composite index - analytics ke liye
@Index(['timestamp'])               // Partition pruning ke liye
export class VehicleTelemetryHistory {

  @PrimaryGeneratedColumn({ type: 'bigint' })
  id: number;

  // Vehicle ID
  @Column({ name: 'vehicle_id', type: 'varchar', length: 50 })
  vehicleId: string;

  // Battery % at this minute
  @Column({ type: 'decimal', precision: 5, scale: 2 })
  soc: number;


  @Column({ name: 'kwh_delivered_dc', type: 'decimal', precision: 10, scale: 3 })
  kwhDeliveredDc: number;

  @Column({ name: 'battery_temp', type: 'decimal', precision: 5, scale: 2 })
  batteryTemp: number;

  // Reading timestamp
  @Column({ type: 'timestamp' })
  timestamp: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}