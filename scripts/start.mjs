import { spawn } from "node:child_process";
import { runtimeEnvironment } from "./runtime-env.mjs";

let env;
try {
  env = runtimeEnvironment();
  for (const name of ["DATABASE_URL", "AUTH_URL", "AUTH_SECRET", "AUTH_GOOGLE_ID", "AUTH_GOOGLE_SECRET"]) {
    if (!env[name]) throw new Error(`Missing ${name}`);
  }
  if (env.AUTH_SECRET.length < 32) throw new Error("AUTH_SECRET must be at least 32 characters");
  if (env.NODE_ENV === "production" && new URL(env.AUTH_URL).protocol !== "https:") {
    throw new Error("Production AUTH_URL must use HTTPS");
  }
} catch (error) {
  console.error("Startup configuration invalid:", error.message);
  process.exit(1);
}
// Heimdall mounts root-owned 0400 secrets. Read once, then drop privileges before migrations/server.
if (process.platform === "linux" && process.getuid?.() === 0) {
  process.setgroups([]);
  process.setgid(1001);
  process.setuid(1001);
}
let child;
for (const signal of ["SIGTERM", "SIGINT"]) process.on(signal, () => child?.kill(signal));
function run(args) {
  return new Promise((resolve) => {
    child = spawn(process.execPath, args, { env, stdio: "inherit" });
    child.on("error", () => resolve(1));
    child.on("exit", (code) => resolve(code ?? 1));
  });
}
const migrated = await run(["scripts/migrate.mjs"]);
if (migrated !== 0) process.exit(migrated);
process.exit(await run(["server.js"]));
