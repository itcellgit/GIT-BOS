// Frozen documents (README §8): when a version is approved its PDF is generated once and stored with
// a SHA-256 checksum and the layout version used, so it reprints exactly as approved even after the
// layout is redesigned. A database trigger refuses any change to a frozen row.
import { createHash, randomUUID } from "node:crypto";
import { versionStatusLabel } from "@acp/shared/domain/reviews/workflow";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { LAYOUT_VERSION } from "@acp/shared/print/syllabus-layout";
import { db } from "../infra/db.js";
import { embeddedFontUrl, htmlToPdf } from "./pdf.js";
import { verificationFor } from "./verification.js";

/**
 * What the print layout takes from the editor data besides the content (see shared/print/syllabus-document.js),
 * saved with an approval so the frozen PDF can be made from it later, unchanged (README §8).
 */
export function printDataOf(data) {
  const { institution, scheme, course, offerings, format, lists, bloomLevels, textBlocks, assignments } = data;
  return { institution, scheme, course, offerings, format, lists, bloomLevels, textBlocks, assignments };
}

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

  // Print what was approved: the snapshot taken at approval, when there is one (approvals since 24 Oct 2026).
  const approval = await db.syllabusApproval.findFirst({
    where: { versionId: version.id },
    orderBy: { createdAt: "asc" },
    select: { printData: true },
  });
  if (approval?.printData) data = { ...data, ...approval.printData };

  // The id is chosen first so the PDF can print its own verification link (README §8).
  const id = randomUUID();
  const html = syllabusHtml(data, content, {
    fontUrl: await embeddedFontUrl(),
    status: { label: versionStatusLabel(version, { official: true }), draft: false },
    verification: await verificationFor(id),
  });
  const pdf = await htmlToPdf(html);
  try {
    return await db.generatedDocument.create({
      data: {
        id,
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
