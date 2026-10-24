// Starts the local development database (embedded PostgreSQL on port 54329, data in .local/pgdata) if it is not
// running. It runs as its own process, so it keeps running after this terminal closes; run this after a reboot.
//   npm run db:start
import { spawn, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createConnection } from "node:net";

const bin = "node_modules/@embedded-postgres/windows-x64/native/bin";
const pgCtl = `${bin}/pg_ctl.exe`;
const port = 54329;

if (!existsSync(pgCtl)) {
  console.error(
    "The database program is missing (npm install removes it). Restore it with:\n" +
      "  npm install --no-save @embedded-postgres/windows-x64@17.10.0-beta.17\nthen run npm run db:start again.",
  );
  process.exit(1);
}

const listening = () =>
  new Promise((resolve) => {
    const socket = createConnection({ port, host: "localhost" }, () => {
      socket.end();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });

if (await listening()) {
  console.log(`The database is already running on port ${port}.`);
  process.exit(0);
}

// A crash or forced stop can leave a stale lock file behind; pg_ctl removes it itself when the process is gone.
const child = spawn(pgCtl, ["-D", ".local/pgdata", "-o", `-p ${port}`, "-l", ".local/postgres.log", "start"], {
  detached: true,
  stdio: "ignore",
  windowsHide: true,
});
child.unref();

for (let i = 0; i < 20; i++) {
  await new Promise((r) => setTimeout(r, 500));
  if (await listening()) {
    console.log(`The database is running on port ${port}.`);
    process.exit(0);
  }
}
console.error("The database did not start. See .local/postgres.log.");
spawnSync("powershell", ["-NoProfile", "-Command", "Get-Content .local/postgres.log -Tail 10"], { stdio: "inherit" });
process.exit(1);
