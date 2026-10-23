// Phase 4 (README §5 "Scheme lifecycle"): moving a department's work into a new scheme.
//   copyCourseList: a programme's course list (Layer 2) from an earlier scheme into a cloned, published one
//   carryForwardSources / carryForwardSyllabus: start a syllabus from a version of an earlier scheme's syllabus
// Categories are matched by code, because a cloned scheme has its own copies of them; every copied row is
// checked against the new scheme's rules, and rows that do not fit are skipped with the reason.
import { formatCredits } from "@acp/shared/domain/schemes/rules";
import { normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { UserError } from "../errors.js";
import { db } from "../infra/db.js";
import { courseIssues } from "./courses.js";

/**
 * Copies the course list of `programme` from `fromSchemeId` into `scheme` (a published scheme, loaded with
 * getSchemeConfig). Rows already listed are left alone. With `withAssignments`, faculty assignments of the
 * courses are copied too. Runs inside the caller's transaction.
 * @returns {Promise<{ copied: string[], skipped: { code: string, reason: string }[], groups: number, psos: number, assignments: number }>}
 */
export async function copyCourseList(tx, { scheme, programme, fromSchemeId, withAssignments }) {
  if (fromSchemeId === scheme.id) throw new UserError("Choose a different scheme to copy from.");
  const [source, sourceRows, sourceGroups, sourcePsos, existingRows, existingGroups, existingPsos] = await Promise.all([
    tx.scheme.findUnique({ where: { id: fromSchemeId } }),
    tx.schemeCourse.findMany({
      where: { schemeId: fromSchemeId, programmeId: programme.id },
      orderBy: [{ semester: "asc" }, { sortOrder: "asc" }],
      include: { course: true, category: true, electiveGroup: true },
    }),
    tx.electiveGroup.findMany({ where: { schemeId: fromSchemeId, programmeId: programme.id } }),
    tx.outcomeItem.findMany({ where: { schemeId: fromSchemeId, programmeId: programme.id, kind: "PSO" } }),
    tx.schemeCourse.findMany({ where: { schemeId: scheme.id, programmeId: programme.id } }),
    tx.electiveGroup.findMany({ where: { schemeId: scheme.id, programmeId: programme.id } }),
    tx.outcomeItem.count({ where: { schemeId: scheme.id, programmeId: programme.id, kind: "PSO" } }),
  ]);
  if (!source) throw new UserError("The scheme to copy from was not found.");
  if (sourceRows.length === 0) throw new UserError(`${programme.code} has no courses in ${source.name}.`);

  // Elective groups by code (created when missing).
  const groupIdByCode = new Map(existingGroups.map((g) => [g.code, g.id]));
  let groups = 0;
  for (const g of sourceGroups) {
    if (groupIdByCode.has(g.code)) continue;
    const created = await tx.electiveGroup.create({
      data: { schemeId: scheme.id, programmeId: programme.id, semester: g.semester, code: g.code, title: g.title },
    });
    groupIdByCode.set(g.code, created.id);
    groups++;
  }

  // PSOs only when the programme has none yet in the new scheme (they are a set, not merged one by one).
  let psos = 0;
  if (existingPsos === 0 && sourcePsos.length) {
    await tx.outcomeItem.createMany({
      data: sourcePsos.map((p) => ({
        schemeId: scheme.id,
        programmeId: programme.id,
        kind: "PSO",
        code: p.code,
        title: p.title,
        description: p.description,
        sortOrder: p.sortOrder,
      })),
    });
    psos = sourcePsos.length;
  }

  const listed = new Set(existingRows.map((r) => r.courseId));
  const categoryByCode = new Map(scheme.categories.map((c) => [c.code, c]));
  const copied = [];
  const skipped = [];
  let sortOrder = existingRows.length;
  for (const r of sourceRows) {
    const code = r.course.code;
    if (listed.has(r.courseId)) {
      skipped.push({ code, reason: "Already in the list." });
      continue;
    }
    const category = categoryByCode.get(r.category.code);
    if (!category) {
      skipped.push({ code, reason: `${scheme.name} has no category ${r.category.code}.` });
      continue;
    }
    const format = r.format && category.allowedFormats.includes(r.format) ? r.format : category.defaultFormat;
    const issues = courseIssues(scheme, { ...r, format }, category);
    if (issues.length) {
      skipped.push({ code, reason: `${formatCredits(r)} ${r.category.code}: ${issues[0].message}` });
      continue;
    }
    await tx.schemeCourse.create({
      data: {
        schemeId: scheme.id,
        programmeId: programme.id,
        semester: r.semester,
        courseId: r.courseId,
        categoryId: category.id,
        format,
        teachingDepartmentId: r.teachingDepartmentId,
        lCredits: r.lCredits,
        tCredits: r.tCredits,
        pCredits: r.pCredits,
        lHours: r.lHours,
        tHours: r.tHours,
        pHours: r.pHours,
        twSlHours: r.twSlHours,
        cieMarks: r.cieMarks,
        seeMarks: r.seeMarks,
        examHours: r.examHours,
        electiveGroupId: r.electiveGroup ? (groupIdByCode.get(r.electiveGroup.code) ?? null) : null,
        sortOrder: sortOrder++,
      },
    });
    listed.add(r.courseId);
    copied.push(code);
  }

  // Faculty assignments of the copied courses this department owns (D13: per scheme and course).
  let assignments = 0;
  if (withAssignments && copied.length) {
    const rows = await tx.courseAssignment.findMany({
      where: {
        schemeId: fromSchemeId,
        course: { code: { in: copied }, owningDepartmentId: programme.departmentId },
        user: { isActive: true },
      },
    });
    const result = await tx.courseAssignment.createMany({
      data: rows.map((a) => ({ schemeId: scheme.id, courseId: a.courseId, userId: a.userId, role: a.role })),
      skipDuplicates: true,
    });
    assignments = result.count;
  }
  return { copied, skipped, groups, psos, assignments };
}

/**
 * Versions of earlier syllabi that a new syllabus can start from: the official (approved) version of each,
 * else its latest. Listed with the same course first, then approved ones, then the newest schemes.
 */
export async function carryForwardSources(scheme, course) {
  const syllabi = await db.syllabus.findMany({
    where: {
      schemeId: { not: scheme.id },
      majorVersion: { gt: 0 },
      course: { owningDepartmentId: course.owningDepartmentId },
    },
    include: {
      scheme: { select: { name: true, createdAt: true } },
      course: { select: { code: true, title: true } },
      officialVersion: { select: { id: true, label: true } },
      versions: {
        orderBy: [{ major: "desc" }, { minor: "desc" }],
        take: 1,
        select: { id: true, label: true },
      },
    },
  });
  return syllabi
    .map((y) => {
      const v = y.officialVersion ?? y.versions[0];
      return {
        versionId: v.id,
        label: `${y.course.code} ${y.course.title} — ${y.scheme.name}, ${v.label}${y.officialVersion ? " (approved)" : ""}`,
        sameCourse: y.courseId === course.id,
        approved: !!y.officialVersion,
        schemeCreatedAt: y.scheme.createdAt,
      };
    })
    .sort(
      (a, b) =>
        b.sameCourse - a.sameCourse ||
        b.approved - a.approved ||
        b.schemeCreatedAt - a.schemeCreatedAt ||
        a.label.localeCompare(b.label),
    )
    .map(({ schemeCreatedAt: _s, ...s }) => s);
}

/**
 * Creates the working copy of a syllabus that has not been started, from a version of an earlier syllabus.
 * The content is fitted to the new format; the checks then run with the new scheme's rules, and the
 * first submission makes it V1.0 like any other syllabus. Runs inside the caller's transaction.
 */
export async function carryForwardSyllabus(tx, { scheme, course, format, versionId, userId }) {
  const sources = await carryForwardSources(scheme, course);
  if (!sources.some((s) => s.versionId === versionId)) {
    throw new UserError("Choose a syllabus of this department from another scheme.", {
      versionId: "Not available for this course",
    });
  }
  const version = await tx.syllabusVersion.findUnique({ where: { id: versionId } });
  return tx.syllabus.create({
    data: {
      schemeId: scheme.id,
      courseId: course.id,
      format: format.format,
      content: normalizeSyllabusContent(version.content, format),
      revision: 1,
      carriedFromId: version.id,
      updatedById: userId,
    },
  });
}
