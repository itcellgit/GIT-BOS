// Dashboards (Phase 4, README §12): where every syllabus of a scheme stands, by department, programme
// and semester. Mounted at /api/dashboard. Each person sees the departments they may view (Dean Academics
// and the Administrator: all; BoS Coordinator and HoD: their own) plus the courses assigned to them.
import { Router } from "express";
import { can, departmentsWithRole } from "@acp/shared/domain/auth/permissions";
import { progressStep } from "@acp/shared/domain/reviews/progress";
import { pendingInputs, versionLabel } from "@acp/shared/domain/reviews/workflow";
import { assertSignedIn } from "../auth/session.js";
import { PermissionError } from "../errors.js";
import { handle } from "../http/handler.js";
import { db } from "../infra/db.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/",
  handle(null, async (_data, req) => {
    const user = assertSignedIn(req);
    const [departments, assigned, schemes] = await Promise.all([
      db.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      // Assigned courses count only while the person is still Faculty of the owning department (as in the editor).
      db.courseAssignment.findMany({
        where: { userId: user.id, course: { owningDepartmentId: { in: departmentsWithRole(user, ["FACULTY"]) } } },
        select: { schemeId: true, courseId: true },
      }),
      db.scheme.findMany({
        where: { status: { not: "DRAFT" } },
        orderBy: [{ status: "asc" }, { publishedAt: "desc" }],
        select: { id: true, name: true, status: true },
      }),
    ]);
    const visible = departments.filter((d) => can(user, "department.view", { departmentId: d.id }));
    if (visible.length === 0 && assigned.length === 0) throw new PermissionError();

    const scheme = schemes.find((s) => s.id === req.query.schemeId) ?? schemes[0] ?? null;
    if (!scheme) return { schemes, scheme: null, rows: [], departments: [] };

    const mine = assigned.filter((a) => a.schemeId === scheme.id).map((a) => a.courseId);
    const courseWhere = {
      OR: [{ owningDepartmentId: { in: visible.map((d) => d.id) } }, { id: { in: mine } }],
    };
    const [schemeRows, syllabi, assignments] = await Promise.all([
      db.schemeCourse.findMany({
        where: { schemeId: scheme.id, category: { syllabusRequired: true }, course: courseWhere },
        include: {
          course: { include: { owningDepartment: { select: { code: true } } } },
          programme: { select: { code: true } },
        },
        orderBy: [{ semester: "asc" }, { course: { code: "asc" } }],
      }),
      db.syllabus.findMany({
        where: { schemeId: scheme.id, course: courseWhere },
        select: {
          id: true,
          courseId: true,
          status: true,
          stage: true,
          majorVersion: true,
          minorVersion: true,
          updatedAt: true,
          _count: { select: { revisionFlags: { where: { resolvedAt: null } } } },
          inputs: { select: { stage: true, actionTaken: true, decision: true } },
        },
      }),
      db.courseAssignment.findMany({
        where: { schemeId: scheme.id, role: "COORDINATOR", course: courseWhere },
        include: { user: { select: { name: true } } },
      }),
    ]);

    // One row per course: one syllabus serves every programme that lists it (D13).
    const rows = new Map();
    for (const r of schemeRows) {
      const row = rows.get(r.courseId);
      if (row) {
        if (!row.programmes.includes(r.programme.code)) row.programmes.push(r.programme.code);
        continue;
      }
      const y = syllabi.find((s) => s.courseId === r.courseId) ?? null;
      const open = y?.status === "IN_REVIEW" ? y.inputs.filter((i) => i.stage === y.stage) : [];
      rows.set(r.courseId, {
        courseId: r.courseId,
        code: r.course.code,
        title: r.course.title,
        department: r.course.owningDepartment.code,
        programmes: [r.programme.code],
        semester: r.semester,
        format: r.format,
        step: progressStep(y),
        label: y && y.majorVersion > 0 ? versionLabel(y.majorVersion, y.minorVersion) : null,
        needsRevision: (y?._count.revisionFlags ?? 0) > 0,
        pendingInputs: pendingInputs(open).length,
        coordinators: assignments.filter((a) => a.courseId === r.courseId).map((a) => a.user.name),
        updatedAt: y?.updatedAt ?? null,
      });
    }
    return {
      schemes,
      scheme,
      departments: visible.map((d) => d.code),
      rows: [...rows.values()],
    };
  }),
);
