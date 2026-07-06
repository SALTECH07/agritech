import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;

let localEnvCache: Record<string, string> | null = null;

function parseEnvValue(value: string) {
  const trimmed = value.trim();
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1);
  }
  return trimmed;
}

function readLocalDotEnv() {
  if (localEnvCache) return localEnvCache;
  localEnvCache = {};

  const nodeProcess = globalThis.process as
    | {
        cwd?: () => string;
        versions?: { node?: string };
      }
    | undefined;

  if (!nodeProcess?.versions?.node || !nodeProcess.cwd) return localEnvCache;

  try {
    const envPath = resolve(nodeProcess.cwd(), ".env");
    if (!existsSync(envPath)) return localEnvCache;
    const raw = readFileSync(envPath, "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const equalIndex = trimmed.indexOf("=");
      if (equalIndex <= 0) continue;
      const key = trimmed.slice(0, equalIndex).trim();
      const value = trimmed.slice(equalIndex + 1);
      if (key) localEnvCache[key] = parseEnvValue(value);
    }
  } catch {
    // Hosted runtimes may not expose a filesystem. In that case rely on
    // platform environment bindings instead.
  }

  return localEnvCache;
}

export function readServerEnv(name: string) {
  return (
    process.env[name]?.trim() || viteEnv?.[name]?.trim() || readLocalDotEnv()[name]?.trim() || ""
  );
}
