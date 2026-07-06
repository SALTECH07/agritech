
-- 1. Avatars: scope SELECT to folder owner
DROP POLICY IF EXISTS "Avatars viewable by authenticated" ON storage.objects;
CREATE POLICY "Users can view their own avatar"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'avatars' AND (auth.uid())::text = (storage.foldername(name))[1]);

-- 2. advice_log: explicit deny for client-side writes (service role bypasses RLS)
CREATE POLICY "No client inserts on advice_log"
  ON public.advice_log FOR INSERT TO authenticated, anon
  WITH CHECK (false);
CREATE POLICY "No client updates on advice_log"
  ON public.advice_log FOR UPDATE TO authenticated, anon
  USING (false) WITH CHECK (false);
CREATE POLICY "No client deletes on advice_log"
  ON public.advice_log FOR DELETE TO authenticated, anon
  USING (false);

-- 3. get_supplier_contact: switch to SECURITY INVOKER
CREATE OR REPLACE FUNCTION public.get_supplier_contact(_supplier_id uuid)
 RETURNS TABLE(phone text, whatsapp text)
 LANGUAGE sql
 STABLE SECURITY INVOKER
 SET search_path TO 'public'
AS $function$
  SELECT s.phone, s.whatsapp
  FROM public.suppliers s
  WHERE s.id = _supplier_id
    AND auth.uid() IS NOT NULL
    AND (s.is_active = true OR s.owner_id = auth.uid());
$function$;
