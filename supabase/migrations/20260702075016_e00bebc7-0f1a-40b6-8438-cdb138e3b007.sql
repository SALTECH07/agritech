ALTER PUBLICATION supabase_realtime ADD TABLE public.readings;
ALTER PUBLICATION supabase_realtime ADD TABLE public.commands;
ALTER PUBLICATION supabase_realtime ADD TABLE public.devices;
ALTER TABLE public.readings REPLICA IDENTITY FULL;
ALTER TABLE public.commands REPLICA IDENTITY FULL;
ALTER TABLE public.devices REPLICA IDENTITY FULL;