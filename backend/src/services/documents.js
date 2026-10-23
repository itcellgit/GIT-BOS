// Frozen documents (README §8): when a version is approved its PDF is generated once and stored with
// a SHA-256 checksum and the layout version used, so it reprints exactly as approved even after the
// layout is redesigned. A database trigger refuses any change to a frozen row.
import { createHash } from "node:crypto";
import { versionStatusLabel } from "@acp/shared/domain/reviews/workflow";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { LAYOUT_VERSION } from "@acp/shared/print/syllabus-layout";
import { db } from "../infra/db.js";
import { embeddedFontUrl, htmlToPdf } from "./pdf.js";

/** Whether the Academic Council approved this version (it stays approved after a later correction). */
export async function isApprovedVersion(versionId) {
  return (await db.syllabusApproval.count({ where: { versionId } })) > 0;
}

/**
 * The frozen PDF of an approved version, generating and storing it the first time.
 * @param {object} data     editor data of the syllabus (institution, scheme, lists, text blocks…)
 * @param {{ id: string, major: number, minor: number, stage: string|null }} version
 * @param {object} content  the version's content
 */
export async function frozenSyllabusPdf(data, version, content) {
  const where = { versionId_kind: { versionId: version.id, kind: "SYLLABUS" } };
  const existing = await db.generatedDocument.findUnique({ where });
  if (existing) return existing;

  const html = syllabusHtml(data, content, {
    fontUrl: await embeddedFontUrl(),
    status: { label: versionStatusLabel(version, { official: true }), draft: false },
  });
  const pdf = await htmlToPdf(html);
  try {
    return await db.generatedDocument.create({
      data: {
        versionId: version.id,
        kind: "SYLLABUS",
        pdf,
        sha256: createHash("sha256").update(pdf).digest("hex"),
        layoutVersion: LAYOUT_VERSION,
      },
    });
  } catch (e) {
    if (e?.code === "P2002") return db.generatedDocument.findUnique({ where }); // frozen by a parallel request
    throw e;
  }
}
