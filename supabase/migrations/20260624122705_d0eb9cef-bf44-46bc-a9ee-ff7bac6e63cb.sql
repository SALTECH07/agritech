
-- 1) devices: registration + claim flow
ALTER TABLE public.devices
  ALTER COLUMN owner_id DROP NOT NULL,
  ADD COLUMN IF NOT EXISTS hardware_id text,
  ADD COLUMN IF NOT EXISTS claim_code text,
  ADD COLUMN IF NOT EXISTS claimed_at timestamptz,
  ADD COLUMN IF NOT EXISTS is_claimed boolean NOT NULL DEFAULT false;

CREATE UNIQUE INDEX IF NOT EXISTS devices_hardware_id_uniq ON public.devices(hardware_id) WHERE hardware_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS devices_claim_code_uniq ON public.devices(claim_code) WHERE claim_code IS NOT NULL;

-- Allow admins to see unclaimed devices too; existing owner policy unchanged

-- 2) alerts: add kind + whatsapp channel
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='alert_channel' AND e.enumlabel='whatsapp') THEN
    ALTER TYPE public.alert_channel ADD VALUE 'whatsapp';
  END IF;
END $$;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type t JOIN pg_enum e ON t.oid=e.enumtypid WHERE t.typname='alert_channel' AND e.enumlabel='sms') THEN
    ALTER TYPE public.alert_channel ADD VALUE 'sms';
  END IF;
END $$;

ALTER TABLE public.alerts
  ADD COLUMN IF NOT EXISTS kind text;

CREATE INDEX IF NOT EXISTS alerts_device_kind_idx ON public.alerts(device_id, kind, created_at DESC);

-- 3) profiles: notification channels + whatsapp number
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_in_app boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS notify_sms boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notify_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_phone text;
