// Department page: courses the department owns and their faculty, the reviewer directory,
// and the department's faculty. Mounted at /api/departments
import { Router } from "express";
import { can } from "@acp/shared/domain/auth/permissions";
import { courseAssignmentSchema, reviewerSchema } from "@acp/shared/schemas/config";
import { assertPermission, assertSignedIn } from "../auth/session.js";
import { NotFoundError, PermissionError, UserError } from "../errors.js";
import { handle } from "../http/handler.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";

export const departmentsRouter = Router();

async function findDepartment(code) {
  const department = await db.department.findUnique({ where: { code: String(code).toUpperCase() } });
  if (!department) throw new NotFoundError("Department not found.");
  return department;
}

departmentsRouter.get(
  "/:code",
  handle(null, async (_data, req) => {
    const user = assertSignedIn(req);
    const department = await findDepartment(req.params.code);
    if (!can(user, "department.view", { departmentId: department.id })) throw new PermissionError();

    const [programmes, schemes, ownedRows, assignments, reviewers, faculty] = await Promise.all([
      db.programme.findMany({ where: { departmentId: department.id, isActive: true }, orderBy: { code: "asc" } }),
      db.scheme.findMany({ where: { status: { not: "RETIRED" } }, orderBy: { code: "desc" } }),
      // Courses this department owns, in published schemes, across all programmes that list them.
      db.schemeCourse.findMany({
        where: {
          course: { owningDepartmentId: department.id },
          scheme: { status: "PUBLISHED" },
          category: { syllabusRequired: true },
        },
        include: { course: true, scheme: true, programme: { select: { code: true } } },
        orderBy: [{ scheme: { code: "desc" } }, { semester: "asc" }, { course: { code: "asc" } }],
      }),
      db.courseAssignment.findMany({
        where: { course: { owningDepartmentId: department.id }, scheme: { status: "PUBLISHED" } },
        include: { user: { select: { name: true } } },
        orderBy: { role: "asc" },
      }),
      db.reviewer.findMany({
        where: { departmentId: department.id },
        orderBy: [{ isActive: "desc" }, { category: "asc" }, { name: "asc" }],
      }),
      db.user.findMany({
        where: { isActive: true, roles: { some: { role: "FACULTY", departmentId: department.id } } },
        orderBy: { name: "asc" },
        select: { id: true, name: true, designation: true },
      }),
    ]);

    // One line per (scheme, course): the same course may appear in several programmes.
    const courses = new Map();
    for (const r of ownedRows) {
      const key = `${r.schemeId}:${r.courseId}`;
      const entry = courses.get(key);
      if (entry) entry.programmes.push(r.programme.code);
      else
        courses.set(key, {
          schemeId: r.schemeId,
          schemeName: r.scheme.name,
          courseId: r.courseId,
          code: r.course.code,
          title: r.course.title,
          semester: r.semester,
          format: r.format,
          programmes: [r.programme.code],
          assignments: assignments.filter((a) => a.schemeId === r.schemeId && a.courseId === r.courseId),
        });
    }

    return {
      department,
      editable: can(user, "department.configure", { departmentId: department.id }),
      programmes,
      schemes,
      courses: [...courses.values()],
      reviewers,
      faculty: faculty.map((f) => ({ ...f, courseCount: assignments.filter((a) => a.userId === f.id).length })),
    };
  }),
);

// --- Reviewer directory -------------------------------------------------------------

const saveReviewer = handle(
  reviewerSchema,
  async (data, req) => {
    const department = await findDepartment(req.params.code);
    const actor = assertPermission(req, "department.configure", { departmentId: department.id });
    const reviewerId = req.params.reviewerId ?? null;
    if (reviewerId) {
      const r = await db.reviewer.findUnique({ where: { id: reviewerId } });
      if (!r || r.departmentId !== department.id) throw new NotFoundError("Reviewer not found.");
    }
    await db.$transaction(async (tx) => {
      const row = reviewerId
        ? await tx.reviewer.update({ where: { id: reviewerId }, data })
        : await tx.reviewer.create({ data: { ...data, departmentId: department.id } });
      await writeAudit(
        {
          actorId: actor.id,
          action: reviewerId ? "reviewer.update" : "reviewer.create",
          entityType: "Reviewer",
          entityId: row.id,
          departmentId: department.id,
          details: { name: data.name, category: data.category },
        },
        tx,
      );
    });
  },
  "Reviewer saved",
);
departmentsRouter.post("/:code/reviewers", saveReviewer);
departmentsRouter.put("/:code/reviewers/:reviewerId", saveReviewer);

// --- Faculty assignments -------------------------------------------------------------------

departmentsRouter.post(
  "/:code/schemes/:schemeId/courses/:courseId/assignments",
  handle(
    courseAssignmentSchema,
    async (data, req) => {
      const department = await findDepartment(req.params.code);
      const actor = assertPermission(req, "department.configure", { departmentId: department.id });
      const { schemeId, courseId } = req.params;
      const [course, scheme, user] = await Promise.all([
        db.course.findUnique({ where: { id: courseId } }),
        db.scheme.findUnique({ where: { id: schemeId } }),
        db.user.findUnique({ where: { id: data.userId }, include: { roles: true } }),
      ]);
      if (!course || course.owningDepartmentId !== department.id) {
        throw new UserError("This course is not owned by your department.");
      }
      if (!scheme || scheme.status !== "PUBLISHED") {
        throw new UserError("Assignments can be made only under a published scheme.");
      }
      if (!user?.isActive || !user.roles.some((r) => r.role === "FACULTY" && r.departmentId === department.id)) {
        throw new UserError("Choose an active faculty member of this department.", {
          userId: "Not a faculty member of this department",
        });
      }
      if (data.role === "COORDINATOR") {
        const existing = await db.courseAssignment.findFirst({ where: { schemeId, courseId, role: "COORDINATOR" } });
        if (existing && existing.userId !== data.userId) {
          throw new UserError(
            "This course already has a Course Coordinator. Remove them first, or add this person as a co-author.",
          );
        }
      }
      await db.$transaction(async (tx) => {
        const row = await tx.courseAssignment.upsert({
          where: { schemeId_courseId_userId: { schemeId, courseId, userId: data.userId } },
          update: { role: data.role },
          create: { schemeId, courseId, userId: data.userId, role: data.role },
        });
        await writeAudit(
          {
            actorId: actor.id,
            action: "assignment.set",
            entityType: "CourseAssignment",
            entityId: row.id,
            departmentId: department.id,
            details: { schemeId, courseCode: course.code, userId: data.userId, role: data.role },
          },
          tx,
        );
      });
    },
    "Faculty assigned",
  ),
);

departmentsRouter.delete(
  "/:code/assignments/:assignmentId",
  handle(
    null,
    async (_data, req) => {
      const department = await findDepartment(req.params.code);
      const actor = assertPermission(req, "department.configure", { departmentId: department.id });
      const a = await db.courseAssignment.findUnique({
        where: { id: req.params.assignmentId },
        include: { course: true },
      });
      if (!a || a.course.owningDepartmentId !== department.id) throw new NotFoundError("Assignment not found.");
      await db.$transaction(async (tx) => {
        await tx.courseAssignment.delete({ where: { id: a.id } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "assignment.remove",
            entityType: "CourseAssignment",
            entityId: a.id,
            departmentId: department.id,
            details: { courseCode: a.course.code, userId: a.userId },
          },
          tx,
        );
      });
    },
    "Assignment removed",
  ),
);
