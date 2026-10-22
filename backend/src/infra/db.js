import { PrismaPg } from "@prisma/adapter-pg";
import prismaClient from "../generated/prisma/index.js";

const { PrismaClient } = prismaClient;

/** Creates a Prisma client for PostgreSQL (used by the API, the seed and the scripts). */
export function createDb(connectionString = process.env.DATABASE_URL) {
  return new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
}

/** The API's single database client. */
export const db = createDb();
