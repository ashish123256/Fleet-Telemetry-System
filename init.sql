CREATE TABLE meter_current_state (
    meter_id        VARCHAR(50)    PRIMARY KEY,        -- Meter ka unique ID
    kwh_consumed_ac DECIMAL(10,3)  NOT NULL,           -- Kitni AC bijli kharch hui (kWh)
    voltage         DECIMAL(6,2)   NOT NULL,           -- Voltage reading (volts)
    last_update     TIMESTAMP      NOT NULL DEFAULT NOW(), -- Kab update hua
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW()  -- Pehli baar kab create hua
);

-- Index: last_update pe - dashboard sorted queries ke liye
CREATE INDEX idx_meter_last_update ON meter_current_state(last_update DESC);


--
CREATE TABLE vehicle_current_state (
    vehicle_id      VARCHAR(50)    PRIMARY KEY,        -- Vehicle ka unique ID
    soc             DECIMAL(5,2)   NOT NULL             -- Battery % (0-100)
                    CHECK (soc >= 0 AND soc <= 100),
    kwh_delivered_dc DECIMAL(10,3) NOT NULL,           -- Kitni DC energy battery mein gayi
    battery_temp    DECIMAL(5,2)   NOT NULL,           -- Battery ka temperature (Celsius)
    last_update     TIMESTAMP      NOT NULL DEFAULT NOW(), -- Kab update hua
    created_at      TIMESTAMP      NOT NULL DEFAULT NOW()
);

-- Index: last_update pe sorting ke liye
CREATE INDEX idx_vehicle_last_update ON vehicle_current_state(last_update DESC);





CREATE TABLE meter_telemetry_history (
    id              BIGSERIAL,                          -- Auto ID
    meter_id        VARCHAR(50)   NOT NULL,             -- Meter ka ID
    kwh_consumed_ac DECIMAL(10,3) NOT NULL,             -- AC energy consumed
    voltage         DECIMAL(6,2)  NOT NULL,             -- Voltage
    timestamp       TIMESTAMP     NOT NULL,             -- Exactly kab ka reading
    created_at      TIMESTAMP     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);    -- Month-wise partition


-- FEBRUARY 2026 partition
CREATE TABLE meter_telemetry_history_2026_02
    PARTITION OF meter_telemetry_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- MARCH 2026 partition
CREATE TABLE meter_telemetry_history_2026_03
    PARTITION OF meter_telemetry_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- APRIL 2026 partition
CREATE TABLE meter_telemetry_history_2026_04
    PARTITION OF meter_telemetry_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');


CREATE INDEX idx_meter_history_lookup
    ON meter_telemetry_history(meter_id, timestamp DESC);

CREATE INDEX idx_meter_history_time
    ON meter_telemetry_history(timestamp DESC);


-- Table 4: EV Vehicle ka poora history

CREATE TABLE vehicle_telemetry_history (
    id               BIGSERIAL,
    vehicle_id       VARCHAR(50)   NOT NULL,            -- Vehicle ID
    soc              DECIMAL(5,2)  NOT NULL,            -- Battery %
    kwh_delivered_dc DECIMAL(10,3) NOT NULL,            -- DC energy delivered
    battery_temp     DECIMAL(5,2)  NOT NULL,            -- Temperature
    timestamp        TIMESTAMP     NOT NULL,            -- Reading ka time
    created_at       TIMESTAMP     NOT NULL DEFAULT NOW()
) PARTITION BY RANGE (timestamp);


-- FEBRUARY 2026 partition
CREATE TABLE vehicle_telemetry_history_2026_02
    PARTITION OF vehicle_telemetry_history
    FOR VALUES FROM ('2026-02-01') TO ('2026-03-01');

-- MARCH 2026 partition
CREATE TABLE vehicle_telemetry_history_2026_03
    PARTITION OF vehicle_telemetry_history
    FOR VALUES FROM ('2026-03-01') TO ('2026-04-01');

-- APRIL 2026 partition
CREATE TABLE vehicle_telemetry_history_2026_04
    PARTITION OF vehicle_telemetry_history
    FOR VALUES FROM ('2026-04-01') TO ('2026-05-01');


CREATE INDEX idx_vehicle_history_lookup
    ON vehicle_telemetry_history(vehicle_id, timestamp DESC);

CREATE INDEX idx_vehicle_history_time
    ON vehicle_telemetry_history(timestamp DESC);



CREATE TABLE vehicle_meter_mapping (
    vehicle_id  VARCHAR(50)  PRIMARY KEY,   
    meter_id    VARCHAR(50)  NOT NULL,      
    assigned_at TIMESTAMP    NOT NULL DEFAULT NOW()
);


CREATE INDEX idx_mapping_meter ON vehicle_meter_mapping(meter_id);


-- ================================================================

-- ================================================================

CREATE OR REPLACE FUNCTION get_vehicle_performance_24h(
    p_vehicle_id  VARCHAR(50),
    p_end_time    TIMESTAMP DEFAULT NOW()
)
RETURNS TABLE (
    vehicle_id        VARCHAR(50),
    meter_id          VARCHAR(50),
    total_ac_consumed DECIMAL(10,3),
    total_dc_delivered DECIMAL(10,3),  
    efficiency_ratio  DECIMAL(5,4),    
    avg_battery_temp  DECIMAL(5,2),    
    reading_count     BIGINT,          
    time_range_start  TIMESTAMP,       
    time_range_end    TIMESTAMP        
) AS $$
DECLARE
    v_meter_id   VARCHAR(50);
    v_start_time TIMESTAMP;
BEGIN
    -- Step 1: 24 hour window calculate karo
    v_start_time := p_end_time - INTERVAL '24 hours';

    SELECT m.meter_id INTO v_meter_id
    FROM vehicle_meter_mapping m
    WHERE m.vehicle_id = p_vehicle_id;

    RETURN QUERY
    WITH vehicle_metrics AS (
        -- Vehicle history se 24 hour ka data
        SELECT
            SUM(v.kwh_delivered_dc) AS dc_total,
            AVG(v.battery_temp)     AS temp_avg,
            COUNT(*)                AS v_count
        FROM vehicle_telemetry_history v
        WHERE v.vehicle_id = p_vehicle_id
          AND v.timestamp   >= v_start_time    -- Partition pruning
          AND v.timestamp   <= p_end_time      -- Index scan
    ),
    meter_metrics AS (
        -- Meter history se 24 hour ka data
        SELECT
            SUM(m.kwh_consumed_ac) AS ac_total
        FROM meter_telemetry_history m
        WHERE m.meter_id  = v_meter_id
          AND m.timestamp >= v_start_time
          AND m.timestamp <= p_end_time
    )
    SELECT
        p_vehicle_id,
        v_meter_id,
        COALESCE(meter_metrics.ac_total,    0),
        COALESCE(vehicle_metrics.dc_total,  0),
        -- Efficiency = DC / AC (agar AC > 0 ho tabhi)
        CASE
            WHEN COALESCE(meter_metrics.ac_total, 0) > 0
            THEN COALESCE(vehicle_metrics.dc_total, 0) / meter_metrics.ac_total
            ELSE 0
        END,
        COALESCE(vehicle_metrics.temp_avg,  0),
        COALESCE(vehicle_metrics.v_count,   0),
        v_start_time,
        p_end_time
    FROM vehicle_metrics, meter_metrics;
END;
$$ LANGUAGE plpgsql;


-- ================================================================
-- SECTION 5: SAMPLE / SEED DATA
-- ================================================================

-- 2 Sample Meters
INSERT INTO meter_current_state (meter_id, kwh_consumed_ac, voltage) VALUES
    ('METER-001', 0, 240.5),
    ('METER-002', 0, 238.2);

-- 2 Sample Vehicles
INSERT INTO vehicle_current_state (vehicle_id, soc, kwh_delivered_dc, battery_temp) VALUES
    ('VEHICLE-001', 45.5, 0, 22.3),
    ('VEHICLE-002', 78.2, 0, 24.1);

-- Vehicle-Meter mapping

INSERT INTO vehicle_meter_mapping (vehicle_id, meter_id) VALUES
    ('VEHICLE-001', 'METER-001'),
    ('VEHICLE-002', 'METER-001');


-- ================================================================
-- TABLE COMMENTS (Documentation)
-- ================================================================
COMMENT ON TABLE meter_current_state IS
    'HOT: Har meter ka sirf latest reading - UPSERT strategy';

COMMENT ON TABLE vehicle_current_state IS
    'HOT: Har vehicle ka sirf latest status - UPSERT strategy';

COMMENT ON TABLE meter_telemetry_history IS
    'COLD: Meter ka poora history - INSERT-only, partitioned by month';

COMMENT ON TABLE vehicle_telemetry_history IS
    'COLD: Vehicle ka poora history - INSERT-only, partitioned by month';

COMMENT ON TABLE vehicle_meter_mapping IS
    'CORRELATION: Vehicle aur Meter ka mapping - efficiency calculate karne ke liye';

COMMENT ON FUNCTION get_vehicle_performance_24h IS
    'ANALYTICS: 24 hour performance - NO full table scan - partition pruning + index';