-- Runs once on first container start (mounted into /docker-entrypoint-initdb.d).
CREATE TABLE IF NOT EXISTS calibration_logs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  idempotency_key       text NOT NULL UNIQUE,          -- makes queue replays safe
  asset_tag             text NOT NULL,
  instrument_type       text NOT NULL CHECK (instrument_type IN ('Flow','Pressure','Level')),
  raw_ma                numeric(7,3)  NOT NULL,
  scaled_value          numeric(14,4) NOT NULL,
  unit                  text NOT NULL,
  range_low             numeric(14,4) NOT NULL,
  range_high            numeric(14,4) NOT NULL,
  technician_name       text NOT NULL,
  -- audit fields
  device_id             text NOT NULL DEFAULT 'unknown',
  created_at            timestamptz NOT NULL,          -- captured on the device
  synced_at             timestamptz NOT NULL DEFAULT now(),  -- received by the server
  synced_by             text NOT NULL,                 -- technician ID
  -- SCADA outbox
  scada_status          text NOT NULL DEFAULT 'pending' CHECK (scada_status IN ('pending','sent','failed')),
  scada_attempts        int NOT NULL DEFAULT 0,
  scada_next_attempt_at timestamptz NOT NULL DEFAULT now(),
  scada_sent_at         timestamptz,
  scada_last_error      text
);
CREATE INDEX IF NOT EXISTS logs_outbox_idx ON calibration_logs (scada_status, scada_next_attempt_at);
CREATE INDEX IF NOT EXISTS logs_asset_idx  ON calibration_logs (asset_tag, created_at DESC);

CREATE TABLE IF NOT EXISTS audit_events (
  id     bigserial PRIMARY KEY,
  log_id uuid NOT NULL REFERENCES calibration_logs(id),
  event  text NOT NULL,
  actor  text NOT NULL,
  detail jsonb,
  at     timestamptz NOT NULL DEFAULT now()
);

-- Append-only audit trail
CREATE OR REPLACE FUNCTION audit_events_immutable() RETURNS trigger AS $$
BEGIN RAISE EXCEPTION 'audit_events is append-only'; END $$ LANGUAGE plpgsql;
DROP TRIGGER IF EXISTS audit_events_no_change ON audit_events;
CREATE TRIGGER audit_events_no_change BEFORE UPDATE OR DELETE ON audit_events
  FOR EACH ROW EXECUTE FUNCTION audit_events_immutable();
