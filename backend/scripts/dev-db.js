// Local development PostgreSQL, run from node_modules (no Docker or installer needed).
// Usage: npm run db:start   (leave the terminal open; Ctrl+C stops the server)
// Data is kept in .local/pgdata. Production uses the Postgres container instead.
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, rmSync } from "node:fs";
import net from "node:net";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Repository-root .local/pgdata, whichever folder the command is run from.
const databaseDir = fileURLToPath(new URL("../../.local/pgdata", import.meta.url));
const port = 54329;
const databaseName = "acp";

const pg = new EmbeddedPostgres({
  databaseDir,
  user: "postgres",
  password: "postgres",
  port,
  persistent: true,
  // UTF-8 like production. Without this, Windows creates the cluster in WIN1252 and text such as
  // "≥", "Σ" or Kannada cannot be saved. Clusters made before this fix: npm run db:utf8
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

/** True if something is already accepting connections on the port. */
function portInUse() {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });
}

if (await portInUse()) {
  console.log(`PostgreSQL is already running on localhost:${port}. Nothing to do — you can run "npm run dev".`);
  process.exit(0);
}

// A lock file without a running server means the last run did not shut down cleanly.
const lockFile = path.join(databaseDir, "postmaster.pid");
if (existsSync(lockFile)) {
  console.log("Removing a stale lock file from a previous run …");
  rmSync(lockFile);
}

const firstRun = !existsSync(databaseDir);
if (firstRun) {
  console.log("Initialising a new local database cluster in .local/pgdata …");
  await pg.initialise();
}

try {
  await pg.start();
} catch (e) {
  console.error("\nPostgreSQL could not start. See the messages above.", e ?? "");
  process.exit(1);
}

if (firstRun) {
  await pg.createDatabase(databaseName);
} else {
  const client = pg.getPgClient("postgres");
  await client.connect();
  const { rows } = await client.query(
    "SELECT pg_encoding_to_char(encoding) AS encoding FROM pg_database WHERE datname = $1",
    [databaseName],
  );
  await client.end();
  if (rows[0] && rows[0].encoding !== "UTF8") {
    console.warn(
      `\nWARNING: the local database uses ${rows[0].encoding}, not UTF-8, so some characters cannot be saved.` +
        `\nWith this server running, convert it (data is kept) in another terminal: npm run db:utf8\n`,
    );
  }
}

console.log(`PostgreSQL is running on localhost:${port} (database "${databaseName}"). Press Ctrl+C to stop.`);

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("\nStopping PostgreSQL …");
  await pg.stop();
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

// Keep the process alive while the server runs.
setInterval(() => {}, 1 << 30);
