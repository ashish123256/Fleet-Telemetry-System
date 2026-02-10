/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable prettier/prettier */
import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';

// Interface: 24-hour performance ka structure
export interface VehiclePerformance24h {
  vehicleId:          string;
  meterId:            string;
  totalAcConsumed:    number;    // Grid se kitni AC bijli (kWh)
  totalDcDelivered:   number;    // Battery mein kitni DC (kWh)
  efficiencyRatio:    number;    // DC/AC (0.0 to 1.0)
  efficiencyPct:      number;    // DC/AC as % (0 to 100)
  energyLoss:         number;    // AC - DC = conversion loss (kWh)
  avgBatteryTemp:     number;    // Average temperature (Celsius)
  readingCount:       number;    // Kitne data points mile
  completeness:       number;    // % completeness (1440 expected)
  status:             'optimal' | 'degraded' | 'critical';
  statusMessage:      string;    // Human-readable message
  timeRangeStart:     Date;
  timeRangeEnd:       Date;
}

interface PerformanceRow {
  vehicle_id: string;
  meter_id: string;
  total_ac_consumed: string | number;
  total_dc_delivered: string | number;
  efficiency_ratio: string | number;
  avg_battery_temp: string | number;
  reading_count: string | number;
  time_range_start: string | Date;
  time_range_end: string | Date;
}



@Injectable()
export class AnalyticsService {
   private readonly logger = new Logger(AnalyticsService.name);

  constructor(private readonly dataSource: DataSource) {}

   async getVehiclePerformance24h(
    vehicleId: string,
    endTime?: Date
  ): Promise<VehiclePerformance24h> {

    const queryEnd = endTime || new Date();
    const startQuery = Date.now();

    this.logger.log(`Analytics: ${vehicleId} at ${queryEnd.toISOString()}`);

    try {
      // Call optimized PostgreSQL function
      // Hindi: Raw SQL function call - TypeORM se zyada fast
      const rows = await this.dataSource.query(
        `SELECT * FROM get_vehicle_performance_24h($1, $2)`,
        [vehicleId, queryEnd]
      );

      if (!rows || rows.length === 0) {
        throw new NotFoundException(
          `Koi data nahi mila vehicle: ${vehicleId}. ` +
          `Pehle seed data run karo ya telemetry bhejo.`
        );
      }

      const r = rows[0] as PerformanceRow;

      // Parse raw DB values
      const totalAc    = parseFloat(r.total_ac_consumed.toString())  || 0;
      const totalDc    = parseFloat(r.total_dc_delivered.toString()) || 0;
      const effRatio   = parseFloat(r.efficiency_ratio.toString())   || 0;
      const avgTemp    = parseFloat(r.avg_battery_temp.toString())   || 0;
      const count      = parseInt(r.reading_count.toString())        || 0;

      // Derived calculations
      const effPct     = parseFloat((effRatio * 100).toFixed(2));
      const energyLoss = parseFloat((totalAc - totalDc).toFixed(3));
      const completeness = parseFloat(((count / 1440) * 100).toFixed(2));

      // Determine efficiency status
  
      let status: 'optimal' | 'degraded' | 'critical';
      let statusMessage: string;

      if (effPct >= 85) {
        status        = 'optimal';
        statusMessage = 'Normal AC-to-DC conversion efficiency';
      } else if (effPct >= 75) {
        status        = 'degraded';
        statusMessage = 'Charger inefficiency detected - schedule maintenance';
      } else {
        status        = 'critical';
        statusMessage = 'CRITICAL: Hardware fault or energy leakage - immediate inspection required';
      }

      this.logger.log(
        `Analytics done: ${vehicleId} | ` +
        `AC=${totalAc} DC=${totalDc} Eff=${effPct}% | ` +
        `${Date.now() - startQuery}ms`
      );

      return {
        vehicleId:       r.vehicle_id,
        meterId:         r.meter_id,
        totalAcConsumed: totalAc,
        totalDcDelivered: totalDc,
        efficiencyRatio: effRatio,
        efficiencyPct:   effPct,
        energyLoss,
        avgBatteryTemp:  avgTemp,
        readingCount:    count,
        completeness,
        status,
        statusMessage,
        timeRangeStart:  new Date(r.time_range_start),
        timeRangeEnd:    new Date(r.time_range_end),
      };

    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      this.logger.error(`Analytics failed: ${error.message}`, error.stack);
      throw err;
    }
  }

    // METHOD 2: FLEET-WIDE ANALYTICS
  // Hindi: Saari fleet ka overall performance
  //        Sabhi vehicles ka average efficiency
  // ----------------------------------------------------------------
  async getFleetPerformance(): Promise<{
    totalVehicles:   number;
    totalAc:         number;
    totalDc:         number;
    avgEfficiency:   number;
    statusBreakdown: { optimal: number; degraded: number; critical: number };
    alerts:          string[];
  }> {
    this.logger.log('Fleet-wide analytics started');

    // Saare active vehicles nikalo
    const vehicles: Array<{ vehicle_id: string }> = await this.dataSource.query(
      `SELECT vehicle_id FROM vehicle_current_state`
    );

    if (!vehicles.length) {
      return {
        totalVehicles: 0, totalAc: 0, totalDc: 0,
        avgEfficiency: 0,
        statusBreakdown: { optimal: 0, degraded: 0, critical: 0 },
        alerts: ['No vehicles found - run seed data first']
      };
    }

    let totalAc = 0, totalDc = 0;
    const breakdown = { optimal: 0, degraded: 0, critical: 0 };
    const alerts: string[] = [];

    // Har vehicle ka performance nikalo
    for (const v of vehicles) {
      try {
        const perf = await this.getVehiclePerformance24h(v.vehicle_id);
        totalAc += perf.totalAcConsumed;
        totalDc += perf.totalDcDelivered;
        breakdown[perf.status]++;
        if (perf.status === 'critical') {
          alerts.push(`CRITICAL: ${v.vehicle_id} - ${perf.efficiencyPct}% efficiency`);
        }
      } catch {
        // Data nahi mila - skip karo
      }
    }

    const avgEff = totalAc > 0
      ? parseFloat(((totalDc / totalAc) * 100).toFixed(2))
      : 0;

    return {
      totalVehicles: vehicles.length,
      totalAc,
      totalDc,
      avgEfficiency: avgEff,
      statusBreakdown: breakdown,
      alerts,
    };
  }


  // ----------------------------------------------------------------
  // METHOD 3: ANOMALY DETECTION
  // Hindi: Kaun si vehicles efficiency threshold se neeche hain
  //        Ye hardware fault detect karne ke liye use hota hai
  // ----------------------------------------------------------------
  async detectAnomalies(threshold = 85): Promise<Array<{
    vehicleId: string;
    efficiencyPct: number;
    status: string;
    energyLoss: number;
  }>> {
    this.logger.log(`Anomaly scan: threshold=${threshold}%`);

    const vehicles: Array<{ vehicle_id: string }> = await this.dataSource.query(
      `SELECT vehicle_id FROM vehicle_current_state`
    );

    const anomalies: Array<{
      vehicleId: string;
      efficiencyPct: number;
      status: string;
      energyLoss: number;
    }> = [];

    for (const v of vehicles) {
      try {
        const p = await this.getVehiclePerformance24h(v.vehicle_id);
        if (p.efficiencyPct < threshold) {
          anomalies.push({
            vehicleId:     p.vehicleId,
            efficiencyPct: p.efficiencyPct,
            status:        p.status,
            energyLoss:    p.energyLoss,
          });
        }
      } catch {
        // Skip vehicles with no data
      }
    }

    // Sabse kharab pehle dikhao
    return anomalies.sort((a, b) => a.efficiencyPct - b.efficiencyPct);
  }
}
