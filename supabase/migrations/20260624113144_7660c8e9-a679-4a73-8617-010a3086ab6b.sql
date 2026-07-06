
-- ============ ENUMS ============
CREATE TYPE public.app_role AS ENUM ('admin', 'farmer');
CREATE TYPE public.command_kind AS ENUM ('pump_on','pump_off','valve_on','valve_off','set_thresholds');
CREATE TYPE public.command_status AS ENUM ('pending','sent','acked','failed','expired');
CREATE TYPE public.alert_level AS ENUM ('info','warning','danger');
CREATE TYPE public.alert_channel AS ENUM ('in_app','email','sms','whatsapp');
CREATE TYPE public.advice_source AS ENUM ('ai','rules');

-- ============ updated_at helper ============
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END $$;

-- ============ PROFILES ============
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT,
  phone TEXT,
  language TEXT NOT NULL DEFAULT 'sw' CHECK (language IN ('sw','en')),
  default_location_name TEXT,
  default_lat DOUBLE PRECISION,
  default_lon DOUBLE PRECISION,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "profiles_select_own" ON public.profiles FOR SELECT TO authenticated USING (id = auth.uid());
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid()) WITH CHECK (id = auth.uid());
CREATE TRIGGER trg_profiles_updated BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)))
  ON CONFLICT (id) DO NOTHING;
  -- Default role: farmer
  INSERT INTO public.user_roles (user_id, role) VALUES (NEW.id, 'farmer') ON CONFLICT DO NOTHING;
  RETURN NEW;
END $$;

-- ============ USER ROLES ============
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE POLICY "roles_select_own" ON public.user_roles FOR SELECT TO authenticated USING (user_id = auth.uid() OR public.has_role(auth.uid(),'admin'));

-- Now create the trigger (uses user_roles)
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============ DEVICES ============
CREATE TABLE public.devices (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_key TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  crop TEXT,
  location_name TEXT,
  lat DOUBLE PRECISION,
  lon DOUBLE PRECISION,
  target_moisture NUMERIC NOT NULL DEFAULT 45,
  pump_on_threshold NUMERIC NOT NULL DEFAULT 30,
  pump_off_threshold NUMERIC NOT NULL DEFAULT 45,
  rain_block_probability NUMERIC NOT NULL DEFAULT 50,
  rain_block_amount_mm NUMERIC NOT NULL DEFAULT 2,
  last_seen_at TIMESTAMPTZ,
  online BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX devices_owner_idx ON public.devices(owner_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.devices TO authenticated;
GRANT ALL ON public.devices TO service_role;
ALTER TABLE public.devices ENABLE ROW LEVEL SECURITY;
CREATE POLICY "devices_owner_all" ON public.devices FOR ALL TO authenticated
  USING (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))
  WITH CHECK (owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE TRIGGER trg_devices_updated BEFORE UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- ============ READINGS ============
CREATE TABLE public.readings (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  soil_moisture NUMERIC,
  soil_ph NUMERIC,
  air_temp NUMERIC,
  air_humidity NUMERIC,
  pump_on BOOLEAN,
  valve_on BOOLEAN,
  raw JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX readings_device_time_idx ON public.readings(device_id, recorded_at DESC);
GRANT SELECT, INSERT ON public.readings TO authenticated;
GRANT USAGE ON SEQUENCE public.readings_id_seq TO authenticated, service_role;
GRANT ALL ON public.readings TO service_role;
ALTER TABLE public.readings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readings_select_owner" ON public.readings FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ COMMANDS ============
CREATE TABLE public.commands (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  issued_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  kind public.command_kind NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.command_status NOT NULL DEFAULT 'pending',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acked_at TIMESTAMPTZ
);
CREATE INDEX commands_device_pending_idx ON public.commands(device_id, status);
GRANT SELECT, INSERT, UPDATE ON public.commands TO authenticated;
GRANT ALL ON public.commands TO service_role;
ALTER TABLE public.commands ENABLE ROW LEVEL SECURITY;
CREATE POLICY "commands_owner_all" ON public.commands FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ WEATHER SNAPSHOTS ============
CREATE TABLE public.weather_snapshots (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  rain_probability NUMERIC,
  rain_amount_mm NUMERIC,
  forecast_summary TEXT,
  raw JSONB,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX weather_device_time_idx ON public.weather_snapshots(device_id, recorded_at DESC);
GRANT SELECT ON public.weather_snapshots TO authenticated;
GRANT USAGE ON SEQUENCE public.weather_snapshots_id_seq TO service_role;
GRANT ALL ON public.weather_snapshots TO service_role;
ALTER TABLE public.weather_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "weather_select_owner" ON public.weather_snapshots FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ ADVICE LOG ============
CREATE TABLE public.advice_log (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID NOT NULL REFERENCES public.devices(id) ON DELETE CASCADE,
  source public.advice_source NOT NULL DEFAULT 'rules',
  language TEXT NOT NULL DEFAULT 'sw',
  message TEXT NOT NULL,
  action TEXT,
  context JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX advice_device_time_idx ON public.advice_log(device_id, created_at DESC);
GRANT SELECT ON public.advice_log TO authenticated;
GRANT USAGE ON SEQUENCE public.advice_log_id_seq TO service_role;
GRANT ALL ON public.advice_log TO service_role;
ALTER TABLE public.advice_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "advice_select_owner" ON public.advice_log FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.devices d WHERE d.id = device_id AND (d.owner_id = auth.uid() OR public.has_role(auth.uid(),'admin'))));

-- ============ ALERTS ============
CREATE TABLE public.alerts (
  id BIGSERIAL PRIMARY KEY,
  device_id UUID REFERENCES public.devices(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  level public.alert_level NOT NULL DEFAULT 'info',
  channel public.alert_channel NOT NULL DEFAULT 'in_app',
  title TEXT NOT NULL,
  body TEXT,
  read_at TIMESTAMPTZ,
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX alerts_user_time_idx ON public.alerts(user_id, created_at DESC);
GRANT SELECT, UPDATE ON public.alerts TO authenticated;
GRANT USAGE ON SEQUENCE public.alerts_id_seq TO service_role;
GRANT ALL ON public.alerts TO service_role;
ALTER TABLE public.alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "alerts_select_own" ON public.alerts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "alerts_update_own" ON public.alerts FOR UPDATE TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
