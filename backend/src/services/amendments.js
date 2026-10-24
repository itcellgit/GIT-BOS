// Scheme amendments (README §5): a Layer-1 change to a published scheme is recorded, every syllabus it
// can affect is flagged "Needs revision", and the checks of those syllabi are re-run with the new rules.
// A flag is resolved by the next version of the syllabus, or by the BoS Coordinator ("no change needed").
import { summarizeIssues } from "@acp/shared/domain/syllabi/validate";
import { db } from "../infra/db.js";
import { queueNotification } from "./notifications.js";
import { buildEditorData, loadSyllabusContext } from "./syllabi.js";

/** Prisma `where` for the syllabi a scope reaches (see amendmentScope in shared/domain/schemes). */
function scopeWhere(schemeId, scope) {
  switch (scope.kind) {
    case "all":
      return { schemeId };
    case "category":
      return { schemeId, course: { schemeCourses: { some: { schemeId, categoryId: scope.categoryId } } } };
    case "format":
      return { schemeId, format: scope.format };
  }
  return null;
}

/**
 * Records an amendment and flags the syllabi it reaches. Call inside the transaction of the change.
 * @returns {Promise<string>} the amendment id
 */
export async function recordAmendment(tx, { schemeId, actorId, action, summary, scope, details }) {
  const where = scopeWhere(schemeId, scope);
  const syllabi = where
    ? await tx.syllabus.findMany({
        where,
        select: { id: true, courseId: true, course: { select: { code: true, title: true } } },
      })
    : [];
  const amendment = await tx.schemeAmendment.create({
    data: {
      schemeId,
      action,
      summary,
      details: { ...details, scope },
      affectedCount: syllabi.length,
      createdById: actorId,
    },
  });
  if (syllabi.length) {
    await tx.syllabusRevisionFlag.createMany({
      data: syllabi.map((s) => ({ syllabusId: s.id, amendmentId: amendment.id })),
    });
    // The course teams hear about it in one digest per person, however many syllabi and changes.
    const scheme = await tx.scheme.findUnique({ where: { id: schemeId }, select: { name: true } });
    const teams = await tx.courseAssignment.findMany({
      where: { schemeId, courseId: { in: syllabi.map((s) => s.courseId) } },
      select: { userId: true, courseId: true },
    });
    for (const s of syllabi) {
      await queueNotification(tx, {
        kind: "needsRevision",
        userIds: teams.filter((t) => t.courseId === s.courseId).map((t) => t.userId),
        actorId,
        payload: {
          course: s.course,
          schemeId,
          schemeName: scheme.name,
          summary,
          path: `/syllabi/${schemeId}/${s.courseId}`,
        },
        groupKey: `revision:${schemeId}`,
        digest: true,
      });
    }
  }
  return amendment.id;
}

/**
 * Re-runs the checks of every syllabus flagged by an amendment, after the change has committed, and
 * stores the counts on the flags. A failure is logged: the flags stay, only without counts.
 */
export async function recheckAmendment(amendmentId) {
  return recheckFlags({ amendmentId });
}

/**
 * The re-check runs after the response, in memory, so a restart in between would leave flags without counts.
 * The server calls this at start-up to finish any open flag still missing them.
 */
export function recheckPendingFlags() {
  return recheckFlags({ resolvedAt: null, errorCount: null });
}

async function recheckFlags(where) {
  const flags = await db.syllabusRevisionFlag.findMany({
    where,
    include: { syllabus: { select: { schemeId: true, courseId: true } } },
  });
  for (const flag of flags) {
    try {
      const ctx = await loadSyllabusContext(null, flag.syllabus.schemeId, flag.syllabus.courseId);
      const { data } = await buildEditorData(ctx);
      const { errors, warnings } = summarizeIssues(data.validation);
      await db.syllabusRevisionFlag.update({
        where: { id: flag.id },
        data: { errorCount: errors, warningCount: warnings },
      });
    } catch (e) {
      console.warn(`[amendment] could not re-check syllabus ${flag.syllabusId}:`, e.message);
    }
  }
}

/** Resolves every open "Needs revision" flag of a syllabus (inside the caller's transaction). */
export function resolveRevisionFlags(tx, syllabusId, { userId, resolution }) {
  return tx.syllabusRevisionFlag.updateMany({
    where: { syllabusId, resolvedAt: null },
    data: { resolvedAt: new Date(), resolvedById: userId, resolution },
  });
}
