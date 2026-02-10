/* eslint-disable prettier/prettier */
// ================================================================
// SEED DATA GENERATOR


import { DataSource } from 'typeorm';
import { dataSourceOptions } from './data-source';

async function seed() {
  console.log('');
  console.log('============================================');
  console.log(' Fleet Telemetry - Data Seeding Started');
  console.log('============================================');

  const ds = new DataSource(dataSourceOptions);
  await ds.initialize();
  console.log('Database connected\n');

  const METERS   = 5;
  const VEHICLES = 10;
  const HOURS    = 24;
  const MINS     = 60;

  const now       = new Date();
  const startTime = new Date(now.getTime() - HOURS * 60 * 60 * 1000);

  // STEP 1: Create meters
  console.log(`Creating ${METERS} meters...`);
  const meterIds: string[] = [];
  for (let i = 1; i <= METERS; i++) {
    const meterId = `METER-${String(i).padStart(3, '0')}`;
    meterIds.push(meterId);
    await ds.query(`
      INSERT INTO meter_current_state (meter_id, kwh_consumed_ac, voltage)
      VALUES ($1, 0, $2)
      ON CONFLICT (meter_id) DO NOTHING
    `, [meterId, 238 + Math.random() * 4]);
  }
  console.log(`Meters created: ${meterIds.join(', ')}\n`);

  // STEP 2: Create vehicles + map to meters
  console.log(`Creating ${VEHICLES} vehicles...`);
  const vehicles: Array<{ vehicleId: string; meterId: string; isFaulty: boolean }> = [];
  for (let i = 1; i <= VEHICLES; i++) {
    const vehicleId = `VEHICLE-${String(i).padStart(3, '0')}`;
    const meterId   = meterIds[i % meterIds.length];  // Distribute across meters

    // Is vehicle mein fault hai? (VEHICLE-007 faulty hai - testing ke liye)
    const isFaulty = vehicleId === 'VEHICLE-007';

    vehicles.push({ vehicleId, meterId, isFaulty });

    await ds.query(`
      INSERT INTO vehicle_current_state (vehicle_id, soc, kwh_delivered_dc, battery_temp)
      VALUES ($1, 50, 0, 22)
      ON CONFLICT (vehicle_id) DO NOTHING
    `, [vehicleId]);

    await ds.query(`
      INSERT INTO vehicle_meter_mapping (vehicle_id, meter_id)
      VALUES ($1, $2)
      ON CONFLICT (vehicle_id) DO NOTHING
    `, [vehicleId, meterId]);

    console.log(`  ${vehicleId} -> ${meterId}${isFaulty ? ' [FAULTY - for anomaly testing]' : ''}`);
  }

  // STEP 3: Generate 24-hour history
  console.log(`\nGenerating ${HOURS} hours of telemetry data...`);
  console.log('This will take 2-3 minutes. Please wait...\n');

  let totalRecords = 0;

  for (let h = 0; h < HOURS; h++) {
    process.stdout.write(`Hour ${h + 1}/${HOURS}... `);

    for (let m = 0; m < MINS; m++) {
      const ts = new Date(startTime.getTime() + (h * 60 + m) * 60 * 1000);
      const isCharging = m < 45; // First 45 min: charging, last 15: idle

      // --- Meter readings ---
      for (const meterId of meterIds) {
        const acKwh = isCharging
          ? 0.4 + Math.random() * 0.2   // Charging: ~0.5 kWh/min
          : 0.05 + Math.random() * 0.05; // Idle: ~0.05 kWh/min
        const voltage = 238 + Math.random() * 4;

        await ds.query(`
          INSERT INTO meter_telemetry_history (meter_id, kwh_consumed_ac, voltage, timestamp)
          VALUES ($1, $2, $3, $4)
        `, [meterId, acKwh, voltage, ts]);

        await ds.query(`
          UPDATE meter_current_state
          SET kwh_consumed_ac = kwh_consumed_ac + $2, voltage = $3, last_update = $4
          WHERE meter_id = $1
        `, [meterId, acKwh, voltage, ts]);

        totalRecords++;
      }

      // --- Vehicle readings ---
      for (const { vehicleId, isFaulty } of vehicles) {
        // Efficiency: normal = 85-92%, faulty = 65-70%
        const efficiency = isFaulty
          ? 0.65 + Math.random() * 0.05   // Faulty: 65-70%
          : 0.85 + Math.random() * 0.07;  // Normal: 85-92%

        const acPerVehicle = isCharging ? 0.5 : 0.05;
        const dcKwh = isCharging ? acPerVehicle * efficiency : 0;

        // SoC increases during charging
        const socIncrease = dcKwh > 0 ? (dcKwh / 75) * 100 : 0; // 75 kWh battery

        const currentState = await ds.query<{ soc: number }[]>(
          `SELECT soc FROM vehicle_current_state WHERE vehicle_id = $1`,
          [vehicleId]
        );
        const currentSoc = currentState[0]?.soc || 50;
        const newSoc = Math.min(100, Math.max(0, currentSoc + socIncrease));

        // Higher temp when charging (especially for faulty charger)
        const temp = isCharging
          ? (isFaulty ? 35 + Math.random() * 8 : 25 + Math.random() * 8)
          : 22 + Math.random() * 3;

        await ds.query(`
          INSERT INTO vehicle_telemetry_history
            (vehicle_id, soc, kwh_delivered_dc, battery_temp, timestamp)
          VALUES ($1, $2, $3, $4, $5)
        `, [vehicleId, newSoc, dcKwh, temp, ts]);

        await ds.query(`
          UPDATE vehicle_current_state
          SET soc = $2, kwh_delivered_dc = kwh_delivered_dc + $3,
              battery_temp = $4, last_update = $5
          WHERE vehicle_id = $1
        `, [vehicleId, newSoc, dcKwh, temp, ts]);

        totalRecords++;
      }
    }

    console.log('done');
  }

  // SUMMARY
  console.log('');
  console.log('============================================');
  console.log(' Seeding Complete!');
  console.log('============================================');
  console.log(`Total records created: ${totalRecords.toLocaleString()}`);
  console.log(`  Meter records:   ${(METERS * HOURS * MINS).toLocaleString()}`);
  console.log(`  Vehicle records: ${(VEHICLES * HOURS * MINS).toLocaleString()}`);
  console.log('');
  console.log('Test endpoints:');
  console.log('  curl http://localhost:3000/api/v1/analytics/performance/VEHICLE-001');
  console.log('  curl http://localhost:3000/api/v1/analytics/anomalies?threshold=85');
  console.log('  [VEHICLE-007 is seeded as faulty - should appear in anomalies]');
  console.log('============================================');

  await ds.destroy();
}

seed().catch((err: Error) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});