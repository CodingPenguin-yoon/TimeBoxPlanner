import pg from "pg";
import { databaseUrl } from "../lib/database-url.mjs";

/** Resolve the role's default schema only when the default public schema is inaccessible.
 * @param {Record<string, string | undefined>} env
 * @param {(message: string) => void} log
 */
export async function resolveDatabaseEnvironment(env, log = console.log) {
  const configured = databaseUrl(env);
  if (!configured) throw new Error("DATABASE_URL is required");
  const url = new URL(configured);
  const requested = url.searchParams.get("schema") || "public";
  const connectionUrl = new URL(url);
  connectionUrl.searchParams.delete("schema");
  const client = new pg.Client({ connectionString: connectionUrl.toString(), connectionTimeoutMillis: 10000 });
  await client.connect();
  try {
    const { rows } = await client.query(`
      SELECT nspname AS name,
             has_schema_privilege(oid, 'USAGE') AND has_schema_privilege(oid, 'CREATE') AS usable,
             nspname = current_schema() AS is_default
      FROM pg_namespace WHERE nspname = $1 OR nspname = current_schema()
    `, [requested]);
    let selected = rows.find((row) => row.name === requested && row.usable)?.name;
    if (!selected && requested === "public") {
      selected = rows.find((row) => row.is_default && row.usable && row.name !== "public" &&
        row.name !== "information_schema" && !row.name.startsWith("pg_"))?.name;
    }
    if (!selected) throw new Error(`Target schema ${requested} is unavailable; the DB role has no usable default application schema`);
    url.searchParams.set("schema", selected);
    log(`Database schema: requested=${requested}, selected=${selected}`);
    // Both migration subprocess and Next.js inherit exactly this resolved setting.
    return { ...env, DATABASE_SCHEMA: selected, DATABASE_URL: url.toString() };
  } finally { await client.end(); }
}
