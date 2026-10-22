// Loads the repository-root .env into process.env (variables already set win).
// Import this first in every entry point: server, seed and scripts.
import { fileURLToPath } from "node:url";
import { config } from "dotenv";

config({ path: fileURLToPath(new URL("../../../.env", import.meta.url)), quiet: true });
