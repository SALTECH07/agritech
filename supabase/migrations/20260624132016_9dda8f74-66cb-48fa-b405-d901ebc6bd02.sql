ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS ip_address text,
  ADD COLUMN IF NOT EXISTS operator_name text,
  ADD COLUMN IF NOT EXISTS dashboard_widgets jsonb NOT NULL DEFAULT '["moisture","ph","air_temp","air_humidity","pump","weather"]'::jsonb;