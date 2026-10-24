// Verification of approved PDFs (README §8): each frozen PDF prints a QR code and link to a public page that
// shows what was approved and compares a copy's SHA-256 with the stored one. The document id in the link is a
// random UUID, so documents cannot be listed by guessing ids.
import QRCode from "qrcode";
import { db } from "../infra/db.js";

/** The public page that verifies document `id`. BETTER_AUTH_URL is the portal's public address (see .env). */
export function verificationUrl(id) {
  const base = (process.env.BETTER_AUTH_URL || "http://localhost:5173").replace(/\/$/, "");
  return `${base}/verify/${id}`;
}

/** What the PDF prints: the link, and its QR code as an SVG data URL. */
export async function verificationFor(id) {
  const url = verificationUrl(id);
  const svg = await QRCode.toString(url, { type: "svg", margin: 0, errorCorrectionLevel: "M" });
  return { url, qrUrl: `data:image/svg+xml;base64,${Buffer.from(svg).toString("base64")}` };
}

/**
 * The public facts about a frozen document, or null. Only what the printed PDF already shows: the course,
 * scheme, programmes, version and approval date — never the content or who reviewed it.
 */
export async function verifiedDocument(id) {
  const doc = await db.generatedDocument.findUnique({
    where: { id },
    select: {
      id: true,
      kind: true,
      sha256: true,
      createdAt: true,
      version: {
        select: {
          id: true,
          label: true,
          approvals: { orderBy: { createdAt: "asc" }, take: 1, select: { createdAt: true } },
          syllabus: {
            select: {
              officialVersionId: true,
              scheme: { select: { name: true } },
              course: { select: { code: true, title: true } },
            },
          },
        },
      },
    },
  });
  if (!doc) return null;
  const { version } = doc;
  return {
    id: doc.id,
    kind: doc.kind,
    sha256: doc.sha256,
    frozenAt: doc.createdAt,
    course: version.syllabus.course,
    scheme: version.syllabus.scheme.name,
    version: version.label,
    approvedAt: version.approvals[0]?.createdAt ?? null,
    // A later approved correction replaces this one as the official syllabus.
    current: version.syllabus.officialVersionId === version.id,
  };
}
