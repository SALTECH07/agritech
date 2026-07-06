ALTER TABLE public.readings
  ADD COLUMN IF NOT EXISTS water_level numeric,
  ADD COLUMN IF NOT EXISTS water_deficit numeric,
  ADD COLUMN IF NOT EXISTS tank_fill_needed boolean,
  ADD COLUMN IF NOT EXISTS irrigation_needed boolean;