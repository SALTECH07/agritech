import { createServerFn } from "@tanstack/react-start";

export const getAIConnectionStatus = createServerFn({ method: "GET" }).handler(async () => {
  const { getAIRuntimeStatus } = await import("@/lib/ai.server");
  return getAIRuntimeStatus();
});
