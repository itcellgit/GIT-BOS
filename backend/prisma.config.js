import { fileURLToPath } from "node:url";
import { config } from "dotenv";
import { defineConfig } from "prisma/config";

// One .env at the repository root serves the backend, Prisma and the scripts.
config({ path: fileURLToPath(new URL("../.env", import.meta.url)), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    // Migrations need the owner role; in production the app itself connects as a least-privilege role
    // (docker-compose.yml), so the CLI prefers MIGRATE_DATABASE_URL when it is set.
    url: process.env.MIGRATE_DATABASE_URL || process.env.DATABASE_URL,
  },
});
