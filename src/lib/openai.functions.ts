import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export const getOpenAIConnectionStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getOpenAIRuntimeStatus } = await import("@/lib/openai.server");
    return getOpenAIRuntimeStatus();
  });
