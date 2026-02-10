/* eslint-disable prettier/prettier */

import {
  Controller, Get, Param,
  Query, Logger,
  ParseIntPipe
} from '@nestjs/common';

import { AnalyticsService } from './analytics.service';


@Controller('v1/analytics')
export class AnalyticsController {
  private readonly logger = new Logger(AnalyticsController.name);

  constructor(private readonly svc: AnalyticsService) {}


  @Get('performance/:vehicleId')
  async getPerformance(@Param('vehicleId') vehicleId: string) {
    this.logger.log(`GET performance: ${vehicleId}`);

    const p = await this.svc.getVehiclePerformance24h(vehicleId);

    return {
      success: true,
      data: {
        // Vehicle info
        vehicle: {
          id:             p.vehicleId,
          associatedMeter: p.meterId,
        },

        // 24-hour time window
        timeRange: {
          start:         p.timeRangeStart,
          end:           p.timeRangeEnd,
          durationHours: 24,
        },

        // REQUIREMENT D: Energy metrics
        energy: {
          totalAcConsumed: {
            value:       p.totalAcConsumed,
            unit:        'kWh',
            description: 'AC energy pulled from grid (fleet owner pays this)',
      
          },
          totalDcDelivered: {
            value:       p.totalDcDelivered,
            unit:        'kWh',
            description: 'DC energy actually stored in battery',
        
          },
          energyLoss: {
            value:       p.energyLoss,
            unit:        'kWh',
            description: 'Energy lost in AC-to-DC conversion (heat)',
          
          },
        },

        // REQUIREMENT D: Efficiency = DC / AC
        efficiency: {
          ratio:       p.efficiencyRatio,      // 0.854
          percentage:  p.efficiencyPct,        // 85.4
          status:      p.status,               // "optimal"
          message:     p.statusMessage,
     
          thresholds: {
            optimal:   '>=85% - Normal operation',
            degraded:  '75-84% - Needs attention',
            critical:  '<75% - Hardware fault likely',
          }
        },

        // REQUIREMENT D: Battery temperature
        battery: {
          avgTemperature: {
            value: p.avgBatteryTemp,
            unit:  'Celsius',
       
          }
        },

        // Data quality info
        dataQuality: {
          readingCount:     p.readingCount,
          expectedReadings: 1440,   // 24 * 60 = 1 reading per minute
          completeness:     `${p.completeness}%`,
        }
      }
    };
  }



  // ENDPOINT 2: GET /v1/analytics/fleet/performance


  @Get('fleet/performance')
  async getFleetPerformance() {
    this.logger.log('GET fleet performance');
    const f = await this.svc.getFleetPerformance();

    return {
      success: true,
      data: {
        summary: {
          totalVehicles:       f.totalVehicles,
          totalAcConsumed:     f.totalAc,
          totalDcDelivered:    f.totalDc,
          fleetEfficiency:     `${f.avgEfficiency}%`,
        },
        vehicleStatus: {
          optimal:  f.statusBreakdown.optimal,
          degraded: f.statusBreakdown.degraded,
          critical: f.statusBreakdown.critical,
        },
        alerts: f.alerts,
      
      }
    };
  }



  // ENDPOINT 3: GET /v1/analytics/anomalies?threshold=85

  @Get('anomalies')
  async getAnomalies(
    @Query('threshold', new ParseIntPipe({ optional: true }))
    threshold = 85
  ) {
    this.logger.log(`GET anomalies: threshold=${threshold}%`);
    const anomalies = await this.svc.detectAnomalies(threshold);

    return {
      success: true,
      data: {
        threshold:         `${threshold}%`,
        anomaliesDetected: anomalies.length,
        vehicles:          anomalies,
        action: anomalies.length > 0
          ? 'Inspect chargers and EV connections for listed vehicles'
          : 'All vehicles operating within normal efficiency range',
      }
    };
  }
}