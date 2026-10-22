import { db } from "../infra/db.js";
import { UserError } from "../errors.js";
import { can } from "@acp/shared/domain/auth/permissions";
/** Layer 1 can be changed while a scheme is DRAFT or PUBLISHED; RETIRED schemes are read-only. */
export async function assertSchemeEditable(schemeId, tx = db) {
  const scheme = await tx.scheme.findUnique({ where: { id: schemeId }, select: { status: true, name: true } });
  if (!scheme) throw new UserError("Scheme not found.");
  if (scheme.status === "RETIRED") throw new UserError(`${scheme.name} is retired and can no longer be changed.`);
  return scheme;
}
export async function getSchemeConfig(schemeId) {
  return db.scheme.findUnique({
    where: { id: schemeId },
    include: {
      categories: { orderBy: [{ sortOrder: "asc" }, { code: "asc" }], include: { creditPatterns: true } },
      formats: { orderBy: { format: "asc" } },
      outcomes: { where: { kind: { not: "PSO" } }, orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
      bloomLevels: { orderBy: { level: "asc" } },
      textBlocks: { orderBy: [{ kind: "asc" }, { sortOrder: "asc" }] },
      clonedFrom: { select: { id: true, name: true } },
    },
  });
}
export function toRuleSettings(scheme) {
  return { teachingWeeks: scheme.teachingWeeks, hoursPerCredit: scheme.hoursPerCredit };
}
export function toCategoryRules(category) {
  return {
    code: category.code,
    passFail: category.passFail,
    hasSee: category.hasSee,
    syllabusRequired: category.syllabusRequired,
    cieMarks: category.cieMarks,
    seeMarks: category.seeMarks,
    allowedFormats: category.allowedFormats,
    creditPatterns: category.creditPatterns,
  };
}
/**
 * Copies all Layer 1 configuration (categories with credit patterns, formats, outcome lists,
 * Bloom levels and text blocks) from one scheme to another. PSOs and course lists (Layer 2)
 * are not copied here.
 */
export async function cloneLayer1(tx, fromSchemeId, toSchemeId) {
  const source = await tx.scheme.findUniqueOrThrow({
    where: { id: fromSchemeId },
    include: {
      categories: { include: { creditPatterns: true } },
      formats: true,
      outcomes: { where: { kind: { not: "PSO" } } },
      bloomLevels: true,
      textBlocks: true,
    },
  });
  for (const c of source.categories) {
    await tx.courseCategory.create({
      data: {
        schemeId: toSchemeId,
        code: c.code,
        name: c.name,
        syllabusRequired: c.syllabusRequired,
        passFail: c.passFail,
        hasSee: c.hasSee,
        cieMarks: c.cieMarks,
        seeMarks: c.seeMarks,
        allowedFormats: c.allowedFormats,
        defaultFormat: c.defaultFormat,
        sortOrder: c.sortOrder,
        creditPatterns: {
          create: c.creditPatterns.map(({ lCredits, tCredits, pCredits, lHours, tHours, pHours }) => ({
            lCredits,
            tCredits,
            pCredits,
            lHours,
            tHours,
            pHours,
          })),
        },
      },
    });
  }
  await tx.formatConfig.createMany({
    data: source.formats.map(({ id: _id, schemeId: _s, sections, ...f }) => ({
      ...f,
      schemeId: toSchemeId,
      sections: sections ?? undefined,
    })),
  });
  await tx.outcomeItem.createMany({
    data: source.outcomes.map(({ id: _id, schemeId: _s, ...o }) => ({ ...o, schemeId: toSchemeId })),
  });
  await tx.bloomLevel.createMany({
    data: source.bloomLevels.map(({ id: _id, schemeId: _s, ...b }) => ({ ...b, schemeId: toSchemeId })),
  });
  await tx.textBlock.createMany({
    data: source.textBlocks.map(({ id: _id, schemeId: _s, updatedAt: _u, ...t }) => ({ ...t, schemeId: toSchemeId })),
  });
}
/** Checks before publishing: the scheme must have the basics configured. */
export async function publishProblems(schemeId) {
  const scheme = await getSchemeConfig(schemeId);
  if (!scheme) return ["Scheme not found."];
  const problems = [];
  if (scheme.categories.length === 0) problems.push("Add at least one course category.");
  for (const c of scheme.categories) {
    if (!c.passFail && c.creditPatterns.length === 0) problems.push(`Category ${c.code} has no credit patterns.`);
    for (const f of c.allowedFormats) {
      if (!scheme.formats.some((x) => x.format === f))
        problems.push(`Category ${c.code} uses a format that is not configured.`);
    }
  }
  if (!scheme.outcomes.some((o) => o.kind === "PO")) problems.push("Add the Programme Outcomes (POs).");
  if (scheme.bloomLevels.length === 0) problems.push("Add the Bloom's taxonomy levels.");
  return [...new Set(problems)];
}
/** Active programmes with their number of courses under the scheme, limited to those the user may view. */
export async function listSchemeProgrammes(schemeId, user) {
  const programmes = await db.programme.findMany({
    where: { isActive: true },
    orderBy: { code: "asc" },
    include: {
      department: true,
      _count: { select: { schemeCourses: { where: { schemeId } } } },
    },
  });
  return programmes.filter((p) => can(user, "department.view", { departmentId: p.departmentId }));
}
