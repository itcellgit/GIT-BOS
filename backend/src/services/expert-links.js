// Expert review links (README §7, rule 6). An expert does not sign in: the link carries a random
// 256-bit token, and only its SHA-256 hash is stored, so a database copy cannot be used to review.
import { createHash, randomBytes } from "node:crypto";
import { PermissionError, NotFoundError } from "../errors.js";
import { db } from "../infra/db.js";

export const hashToken = (token) => createHash("sha256").update(String(token)).digest("hex");

/** A new token (shown once) and the hash to store. */
export function newToken() {
  const token = randomBytes(32).toString("base64url");
  return { token, tokenHash: hashToken(token) };
}

/** The page an expert opens. BETTER_AUTH_URL is the portal's public address (see .env). */
export function expertLinkUrl(token) {
  const base = (process.env.BETTER_AUTH_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/expert/${token}`;
}

/** Whether the link can still be used, as a status word for the review page. */
export function linkStatus(link, now = new Date()) {
  if (link.revokedAt) return "REVOKED";
  if (link.expiresAt <= now) return "EXPIRED";
  return "ACTIVE";
}

/**
 * The link for a token, with its syllabus, version and reviewer. Throws 404 for an unknown token and
 * 410 for a withdrawn or expired one. `open` tells whether comments can still be added: only while
 * the syllabus is in the expert stage.
 */
export async function openExpertLink(token) {
  const link = await db.expertLink.findUnique({
    where: { tokenHash: hashToken(token) },
    include: {
      reviewer: true,
      version: true,
      syllabus: { select: { id: true, schemeId: true, courseId: true, status: true, stage: true } },
    },
  });
  if (!link) throw new NotFoundError("This review link is not valid. Check that you copied the whole link.");
  const status = linkStatus(link);
  if (status === "REVOKED")
    throw new PermissionError("This review link has been withdrawn by the BoS Coordinator.", 410, "LINK_REVOKED");
  if (status === "EXPIRED")
    throw new PermissionError(
      "This review link has expired. Ask the BoS Coordinator for a new one if you still want to comment.",
      410,
      "LINK_EXPIRED",
    );
  const open = link.syllabus.status === "IN_REVIEW" && link.syllabus.stage === "EXPERT";
  return { link, open };
}
