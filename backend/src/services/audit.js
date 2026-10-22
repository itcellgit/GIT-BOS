import { db } from "../infra/db.js";
/** Appends an audit record. Pass the transaction client so the record commits with the change. */
export async function writeAudit(entry, tx = db) {
  await tx.auditLog.create({ data: entry });
}
