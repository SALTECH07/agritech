
-- 1) Avatars: restrict public select on storage to authenticated only
DROP POLICY IF EXISTS "Avatar images are publicly accessible" ON storage.objects;
CREATE POLICY "Avatars viewable by authenticated"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars');

-- 2) Suppliers: hide phone/whatsapp from broad row reads via column-level revoke
REVOKE SELECT (phone, whatsapp) ON public.suppliers FROM authenticated;
REVOKE SELECT (phone, whatsapp) ON public.suppliers FROM anon;

CREATE OR REPLACE FUNCTION public.get_supplier_contact(_supplier_id uuid)
RETURNS TABLE(phone text, whatsapp text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT s.phone, s.whatsapp
  FROM public.suppliers s
  WHERE s.id = _supplier_id
    AND auth.uid() IS NOT NULL
    AND (s.is_active = true OR s.owner_id = auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.get_supplier_contact(uuid) TO authenticated;

-- 3) Devices: auto-null claim_code once device is claimed
CREATE OR REPLACE FUNCTION public.tg_clear_claim_code()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.is_claimed = true THEN
    NEW.claim_code := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS devices_clear_claim_code ON public.devices;
CREATE TRIGGER devices_clear_claim_code
  BEFORE INSERT OR UPDATE ON public.devices
  FOR EACH ROW EXECUTE FUNCTION public.tg_clear_claim_code();
