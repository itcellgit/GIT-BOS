import { db } from "../infra/db.js";
import { UserError } from "../errors.js";
import { getSchemeConfig, toCategoryRules, toRuleSettings } from "./schemes.js";
import { validateSchemeCourse } from "@acp/shared/domain/schemes/rules";
export async function getProgrammeCourseList(schemeId, programmeId) {
  const [scheme, programme] = await Promise.all([
    getSchemeConfig(schemeId),
    db.programme.findUnique({ where: { id: programmeId }, include: { department: true } }),
  ]);
  if (!scheme || !programme) return null;
  const [courses, electiveGroups, psos] = await Promise.all([
    db.schemeCourse.findMany({
      where: { schemeId, programmeId },
      orderBy: [{ semester: "asc" }, { sortOrder: "asc" }, { course: { code: "asc" } }],
      include: {
        course: { include: { owningDepartment: true } },
        category: { include: { creditPatterns: true } },
        teachingDepartment: true,
        electiveGroup: true,
      },
    }),
    db.electiveGroup.findMany({ where: { schemeId, programmeId }, orderBy: [{ semester: "asc" }, { code: "asc" }] }),
    db.outcomeItem.findMany({ where: { schemeId, programmeId, kind: "PSO" }, orderBy: { sortOrder: "asc" } }),
  ]);
  const assignments = await db.courseAssignment.findMany({
    where: { schemeId, courseId: { in: courses.map((c) => c.courseId) } },
    include: { user: { select: { name: true } } },
    orderBy: { role: "asc" },
  });
  const facultyByCourse = new Map();
  for (const a of assignments)
    facultyByCourse.set(a.courseId, [...(facultyByCourse.get(a.courseId) ?? []), a.user.name]);
  return {
    scheme,
    programme,
    courses: courses.map((c) => ({ ...c, faculty: facultyByCourse.get(c.courseId) ?? [] })),
    electiveGroups,
    psos,
  };
}
/** Rule issues for one course row, using the scheme's current Layer 1 settings. */
export function courseIssues(scheme, row, category) {
  if (!category) return [{ field: "credits", severity: "error", message: "Unknown course category." }];
  return validateSchemeCourse(
    {
      lCredits: row.lCredits,
      tCredits: row.tCredits,
      pCredits: row.pCredits,
      lHours: row.lHours,
      tHours: row.tHours,
      pHours: row.pHours,
      twSlHours: row.twSlHours,
      cieMarks: row.cieMarks,
      seeMarks: row.seeMarks,
      format: row.format,
    },
    toCategoryRules(category),
    toRuleSettings(scheme),
  );
}
/** Turns rule issues into form field errors (credit-pattern problems are shown on the L credits field). */
export function issuesToFieldErrors(issues) {
  const fieldErrors = {};
  for (const i of issues) {
    const key = i.field === "credits" ? "lCredits" : i.field;
    fieldErrors[key] = fieldErrors[key] ? `${fieldErrors[key]} ${i.message}` : i.message;
  }
  return fieldErrors;
}
/**
 * Creates or updates one course row of a programme's scheme. The course identity (code) is shared
 * across programmes; a new course is owned by its teaching department (README §3, Q1).
 * Throws UserError with field errors when the row breaks the scheme rules.
 */
export async function upsertSchemeCourse(tx, scheme, programmeId, input, schemeCourseId) {
  const category = scheme.categories.find((c) => c.id === input.categoryId);
  if (!category) throw new UserError("Choose a category from this scheme.", { categoryId: "Unknown category" });
  const issues = courseIssues(scheme, input, category);
  if (issues.length) throw new UserError("The course does not match the scheme rules.", issuesToFieldErrors(issues));
  if (input.electiveGroupId) {
    const group = await tx.electiveGroup.findUnique({ where: { id: input.electiveGroupId } });
    if (!group || group.schemeId !== scheme.id || group.programmeId !== programmeId) {
      throw new UserError("Unknown elective group.", { electiveGroupId: "Choose a group from this programme" });
    }
  }
  let course = await tx.course.findUnique({ where: { code: input.code }, include: { owningDepartment: true } });
  if (course) {
    if (course.title !== input.title) {
      // The title is shared by every programme that lists the course (D13): only the owning department's
      // course list may change it, so another department cannot rename a course it does not own.
      const programme = await tx.programme.findUnique({ where: { id: programmeId }, select: { departmentId: true } });
      if (programme?.departmentId !== course.owningDepartmentId) {
        throw new UserError(
          `${input.code} is owned by ${course.owningDepartment.code}; only ${course.owningDepartment.code} can change its title (“${course.title}”).`,
          { title: `Keep “${course.title}”` },
        );
      }
      course = await tx.course.update({ where: { id: course.id }, data: { title: input.title } });
    }
  } else {
    course = await tx.course.create({
      data: { code: input.code, title: input.title, owningDepartmentId: input.teachingDepartmentId },
    });
  }
  const data = {
    semester: input.semester,
    categoryId: input.categoryId,
    format: input.format,
    teachingDepartmentId: input.teachingDepartmentId,
    lCredits: input.lCredits,
    tCredits: input.tCredits,
    pCredits: input.pCredits,
    lHours: input.lHours,
    tHours: input.tHours,
    pHours: input.pHours,
    twSlHours: input.twSlHours,
    cieMarks: input.cieMarks,
    seeMarks: input.seeMarks,
    examHours: input.examHours,
    electiveGroupId: input.electiveGroupId,
  };
  if (schemeCourseId) {
    const existing = await tx.schemeCourse.findUnique({ where: { id: schemeCourseId } });
    if (!existing || existing.schemeId !== scheme.id || existing.programmeId !== programmeId) {
      throw new UserError("Course row not found.");
    }
    if (existing.courseId !== course.id) {
      const clash = await tx.schemeCourse.findFirst({
        where: { schemeId: scheme.id, programmeId, courseId: course.id },
      });
      if (clash) throw new UserError(`${input.code} is already in this programme's list.`, { code: "Already listed" });
    }
    return tx.schemeCourse.update({ where: { id: schemeCourseId }, data: { ...data, courseId: course.id } });
  }
  const clash = await tx.schemeCourse.findFirst({ where: { schemeId: scheme.id, programmeId, courseId: course.id } });
  if (clash) throw new UserError(`${input.code} is already in this programme's list.`, { code: "Already listed" });
  const count = await tx.schemeCourse.count({ where: { schemeId: scheme.id, programmeId } });
  return tx.schemeCourse.create({
    data: { ...data, schemeId: scheme.id, programmeId, courseId: course.id, sortOrder: count },
  });
}
/** Layer 2 changes are allowed only under a published scheme. */
export function assertSchemeOpenForDepartments(scheme) {
  if (scheme.status === "DRAFT")
    throw new UserError(`${scheme.name} is still a draft. Dean Academics must publish it first.`);
  if (scheme.status === "RETIRED") throw new UserError(`${scheme.name} is retired and can no longer be changed.`);
}
