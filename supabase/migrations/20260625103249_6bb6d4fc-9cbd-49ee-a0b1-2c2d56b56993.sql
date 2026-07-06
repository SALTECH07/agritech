
CREATE TABLE public.farm_finance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  device_id uuid REFERENCES public.devices(id) ON DELETE SET NULL,
  season text NOT NULL DEFAULT '',
  entry_type text NOT NULL CHECK (entry_type IN ('income','expense')),
  category text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL DEFAULT 0,
  currency text NOT NULL DEFAULT 'TZS',
  description text,
  occurred_at date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.farm_finance TO authenticated;
GRANT ALL ON public.farm_finance TO service_role;

ALTER TABLE public.farm_finance ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owners manage their finance" ON public.farm_finance
  FOR ALL USING (auth.uid() = owner_id) WITH CHECK (auth.uid() = owner_id);

CREATE INDEX farm_finance_owner_idx ON public.farm_finance(owner_id, occurred_at DESC);
CREATE INDEX farm_finance_device_idx ON public.farm_finance(device_id);

CREATE TRIGGER farm_finance_set_updated_at
  BEFORE UPDATE ON public.farm_finance
  FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
