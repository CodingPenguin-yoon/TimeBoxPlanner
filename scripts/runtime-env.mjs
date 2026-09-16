import { readFileSync } from "node:fs";
import { databaseUrl } from "../lib/database-url.mjs";

/** @param {Record<string, string | undefined>} source */
export function runtimeEnvironment(source = process.env) {
  const env = { ...source };
  // Heimdall SECRET variables contain mounted file paths, not secret values.
  for (const name of ["AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]) {
    const file = env[`${name}_FILE`] || (env[name]?.startsWith("/run/secrets/") ? env[name] : undefined);
    if (file) env[name] = readFileSync(file, "utf8").trimEnd();
  }
  if (!env.DATABASE_URL && env.DATABASE_HOST) {
    for (const name of ["DATABASE_USER", "DATABASE_NAME", "DATABASE_PASSWORD_FILE"]) {
      if (!env[name]) throw new Error(`Missing ${name}`);
    }
    const password = readFileSync(env.DATABASE_PASSWORD_FILE, "utf8").trimEnd();
    const url = new URL("postgresql://localhost");
    url.hostname = env.DATABASE_HOST;
    url.port = env.DATABASE_PORT || "5432";
    url.username = env.DATABASE_USER;
    url.password = password;
    url.pathname = `/${encodeURIComponent(env.DATABASE_NAME)}`;
    env.DATABASE_URL = url.toString();
  }
  env.DATABASE_URL = databaseUrl(env);
  return env;
}
