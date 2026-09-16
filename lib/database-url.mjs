/**
 * Keep the migration CLI and application queries on the same Heimdall schema.
 * @param {Record<string, string | undefined>} env
 */
export function databaseUrl(env = process.env) {
  if (env.DATABASE_HOST && !env.DATABASE_SCHEMA?.trim()) {
    throw new Error("DATABASE_SCHEMA is required for the managed database");
  }
  if (!env.DATABASE_URL) return undefined;
  if (!env.DATABASE_SCHEMA?.trim()) return env.DATABASE_URL;
  const url = new URL(env.DATABASE_URL);
  if (!["postgresql:", "postgres:"].includes(url.protocol)) {
    throw new Error("Managed database requires a PostgreSQL connection URL");
  }
  // Managed schema wins over an absent or stale ?schema=public in DATABASE_URL.
  url.searchParams.set("schema", env.DATABASE_SCHEMA.trim());
  return url.toString();
}
