/* eslint-disable prettier/prettier */
import {
  Entity, Column, PrimaryColumn,
  CreateDateColumn, UpdateDateColumn, Index
} from 'typeorm';

@Entity('meter_current_state')
@Index(['lastUpdate'])
export class MeterCurrentState {

  // Primary Key: Meter ka unique ID
  @PrimaryColumn({ name: 'meter_id', type: 'varchar', length: 50 })
  meterId: string;

  // Kitni AC bijli kharch hui (kWh)
  // Hindi: Yeh fleet owner ki bill determine karta hai
  @Column({ name: 'kwh_consumed_ac', type: 'decimal', precision: 10, scale: 3 })
  kwhConsumedAc: number;

  // Voltage reading
  @Column({ type: 'decimal', precision: 6, scale: 2 })
  voltage: number;

  // Kab update hua - automatically update hota hai
  @UpdateDateColumn({ name: 'last_update', type: 'timestamp' })
  lastUpdate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}


@Entity('vehicle_current_state')
@Index(['lastUpdate'])
export class VehicleCurrentState {

  // Primary Key: Vehicle ka unique ID
  @PrimaryColumn({ name: 'vehicle_id', type: 'varchar', length: 50 })
  vehicleId: string;

  // State of Charge: Battery kitni % bhari hai (0-100)

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  soc: number;

 
  @Column({ name: 'kwh_delivered_dc', type: 'decimal', precision: 10, scale: 3 })
  kwhDeliveredDc: number;

  // Battery ka temperature (Celsius)
 
  @Column({ name: 'battery_temp', type: 'decimal', precision: 5, scale: 2 })
  batteryTemp: number;

  @UpdateDateColumn({ name: 'last_update', type: 'timestamp' })
  lastUpdate: Date;

  @CreateDateColumn({ name: 'created_at', type: 'timestamp' })
  createdAt: Date;
}


// ----------------------------------------------------------------
// Entity 3: vehicle_meter_mapping

@Entity('vehicle_meter_mapping')
@Index(['meterId'])
export class VehicleMeterMapping {

  @PrimaryColumn({ name: 'vehicle_id', type: 'varchar', length: 50 })
  vehicleId: string;

  @Column({ name: 'meter_id', type: 'varchar', length: 50 })
  meterId: string;

  @CreateDateColumn({ name: 'assigned_at', type: 'timestamp' })
  assignedAt: Date;
}