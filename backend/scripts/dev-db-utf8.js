// Converts the local development database to UTF-8, keeping all data. Development only.
// Usage: npm run db:start   (in one terminal), then:  npm run db:utf8
//
// Local clusters created on Windows before dev-db.js asked for UTF-8 use WIN1252, which cannot store
// characters such as "≥", "Σ" or Kannada. This script:
//   1. creates "acp_utf8" (UTF-8) and applies the migrations to it,
//   2. copies every table from "acp" (values are copied as text, so every column type round-trips),
//   3. renames "acp" to "acp_win1252_backup" and "acp_utf8" to "acp".
// Stop "npm run dev" first, or it will lose its database connection for a moment.
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import pg from "pg";

const base = "postgresql://postgres:postgres@localhost:54329";
const source = "acp";
const target = "acp_utf8";
const backup = "acp_win1252_backup";
const backendDir = fileURLToPath(new URL("..", import.meta.url));

const admin = new pg.Client(`${base}/postgres`);
await admin.connect();
const encodingOf = async (name) =>
  (await admin.query("SELECT pg_encoding_to_char(encoding) AS e FROM pg_database WHERE datname = $1", [name])).rows[0]
    ?.e;

if ((await encodingOf(source)) === "UTF8") {
  console.log(`"${source}" already uses UTF-8. Nothing to do.`);
  await admin.end();
  process.exit(0);
}
if (await encodingOf(backup)) {
  console.error(`A database named "${backup}" already exists. Drop or rename it first.`);
  process.exit(1);
}

console.log(`1/3 Creating "${target}" (UTF-8) and applying migrations …`);
await admin.query(`DROP DATABASE IF EXISTS ${target}`);
// The C locale works with any encoding; production (the postgres image) uses en_US.utf8.
await admin.query(`CREATE DATABASE ${target} ENCODING 'UTF8' LC_COLLATE 'C' LC_CTYPE 'C' TEMPLATE template0`);
execSync("npx prisma migrate deploy", {
  cwd: backendDir,
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: `${base}/${target}` },
});

console.log("2/3 Copying data …");
// Read every value as its text form and let PostgreSQL convert it back into the column's type.
const from = new pg.Client({ connectionString: `${base}/${source}`, types: { getTypeParser: () => (v) => v } });
const to = new pg.Client(`${base}/${target}`);
await from.connect();
await to.connect();
await to.query("SET session_replication_role = replica"); // foreign keys are checked by the source already
const tables = (
  await from.query(
    "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations' ORDER BY tablename",
  )
).rows.map((r) => r.tablename);
for (const table of tables) {
  const { rows, fields } = await from.query(`SELECT * FROM "${table}"`);
  const columns = fields.map((f) => `"${f.name}"`).join(", ");
  for (const row of rows) {
    const values = fields.map((f) => row[f.name]);
    const params = values.map((_, i) => `$${i + 1}`).join(", ");
    await to.query(`INSERT INTO "${table}" (${columns}) VALUES (${params})`, values);
  }
  const copied = Number((await to.query(`SELECT count(*) FROM "${table}"`)).rows[0].count);
  if (copied !== rows.length) throw new Error(`${table}: copied ${copied} of ${rows.length} rows.`);
  console.log(`   ${table}: ${rows.length}`);
}
// Serial columns (if any): continue after the copied ids.
const sequences = await to.query(
  `SELECT s.relname AS seq, t.relname AS tbl, a.attname AS col
     FROM pg_class s JOIN pg_depend d ON d.objid = s.oid
     JOIN pg_class t ON t.oid = d.refobjid JOIN pg_attribute a ON a.attrelid = t.oid AND a.attnum = d.refobjsubid
    WHERE s.relkind = 'S'`,
);
for (const { seq, tbl, col } of sequences.rows) {
  await to.query(`SELECT setval('"${seq}"', COALESCE((SELECT max("${col}") FROM "${tbl}"), 0) + 1, false)`);
}
await from.end();
await to.end();

console.log("3/3 Swapping databases …");
await admin.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname IN ($1, $2)", [source, target]);
await admin.query(`ALTER DATABASE ${source} RENAME TO ${backup}`);
await admin.query(`ALTER DATABASE ${target} RENAME TO ${source}`);
await admin.end();
console.log(`Done. "${source}" now uses UTF-8. The old database is kept as "${backup}" (drop it when satisfied).`);
