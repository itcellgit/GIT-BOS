// Layer 2 — BoS Coordinator: a programme's course list under a scheme (README §5).
// Mounted at /api/schemes/:schemeId/programmes/:programmeId
import { Router } from "express";
import multer from "multer";
import { can } from "@acp/shared/domain/auth/permissions";
import { copyCourseListSchema, electiveGroupSchema, psoSchema, schemeCourseSchema } from "@acp/shared/schemas/config";
import { assertPermission, assertSignedIn } from "../auth/session.js";
import { NotFoundError, PermissionError, UserError } from "../errors.js";
import { handle, sendError } from "../http/handler.js";
import { pdfRoute } from "../http/pdf.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
import { buildSyllabusBook } from "../services/book.js";
import { copyCourseList } from "../services/carry-forward.js";
import { buildCourseWorkbook, importCourseWorkbook } from "../services/course-excel.js";
import {
  assertSchemeOpenForDepartments,
  courseIssues,
  getProgrammeCourseList,
  upsertSchemeCourse,
} from "../services/courses.js";
import { getSchemeConfig, toCategoryRules, toRuleSettings } from "../services/schemes.js";

export const courseListsRouter = Router({ mergeParams: true });

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

/** Permission + state checks shared by every Layer 2 change. */
async function context(req) {
  const { schemeId, programmeId } = req.params;
  const programme = await db.programme.findUnique({ where: { id: programmeId } });
  if (!programme) throw new NotFoundError("Programme not found.");
  const actor = assertPermission(req, "department.configure", { departmentId: programme.departmentId });
  const scheme = await getSchemeConfig(schemeId);
  if (!scheme) throw new NotFoundError("Scheme not found.");
  assertSchemeOpenForDepartments(scheme);
  return { actor, scheme, programme };
}

/** The list for viewing (BoS Coordinator, HoD, Dean, Admin). */
async function viewableList(req) {
  const user = assertSignedIn(req);
  const list = await getProgrammeCourseList(req.params.schemeId, req.params.programmeId);
  if (!list) throw new NotFoundError("Course list not found.");
  if (!can(user, "department.view", { departmentId: list.programme.departmentId })) throw new PermissionError();
  return { user, list };
}

// --- Reading ------------------------------------------------------------------------

courseListsRouter.get(
  "/",
  handle(null, async (_data, req) => {
    const { user, list } = await viewableList(req);
    const { scheme, programme, courses, electiveGroups, psos } = list;
    const categoryById = new Map(scheme.categories.map((c) => [c.id, c]));
    const [departments, copySources] = await Promise.all([
      db.department.findMany({ where: { isActive: true }, orderBy: { code: "asc" } }),
      // Earlier schemes in which this programme has a course list (Phase 4: copy into a cloned scheme).
      db.scheme.findMany({
        where: { id: { not: scheme.id }, schemeCourses: { some: { programmeId: programme.id } } },
        orderBy: { code: "desc" },
        select: {
          id: true,
          name: true,
          _count: { select: { schemeCourses: { where: { programmeId: programme.id } } } },
        },
      }),
    ]);
    return {
      copySources: copySources.map((s) => ({ id: s.id, name: s.name, courseCount: s._count.schemeCourses })),
      scheme,
      programme,
      electiveGroups,
      psos,
      departments,
      courses: courses.map((c) => ({ ...c, issues: courseIssues(scheme, c, categoryById.get(c.categoryId)) })),
      editable:
        can(user, "department.configure", { departmentId: programme.departmentId }) && scheme.status === "PUBLISHED",
      // Lets the course form check rules in the browser as the user types.
      courseRules: {
        scheme: toRuleSettings(scheme),
        categories: scheme.categories.map((c) => ({ ...toCategoryRules(c), id: c.id, defaultFormat: c.defaultFormat })),
      },
    };
  }),
);

/** Downloads the course list as an Excel workbook (also the import template). */
courseListsRouter.get("/workbook", async (req, res) => {
  try {
    const { list } = await viewableList(req);
    const body = await buildCourseWorkbook(list);
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${list.programme.code}-${list.scheme.code}-courses.xlsx"`,
    );
    res.setHeader("Cache-Control", "no-store");
    res.send(body);
  } catch (e) {
    sendError(res, e);
  }
});

/**
 * Compiled syllabus book (Phase 4, README §8): cover, scheme table, contents with bookmarks, then the approved
 * syllabi. `?semester=3` for one semester; without it, the whole programme.
 */
courseListsRouter.get(
  "/book/pdf",
  pdfRoute(async (req) => {
    const { list } = await viewableList(req);
    const semester = req.query.semester ? Number(req.query.semester) : null;
    if (semester !== null && !Number.isInteger(semester)) throw new UserError("Unknown semester.");
    return buildSyllabusBook({ schemeId: list.scheme.id, programmeId: list.programme.id, semester });
  }),
);

// --- Course rows ----------------------------------------------------------------------

const saveSchemeCourse = handle(
  schemeCourseSchema,
  async (data, req) => {
    const rowId = req.params.rowId ?? null;
    const { actor, scheme, programme } = await context(req);
    await db.$transaction(async (tx) => {
      const row = await upsertSchemeCourse(tx, scheme, programme.id, data, rowId);
      await writeAudit(
        {
          actorId: actor.id,
          action: rowId ? "schemeCourse.update" : "schemeCourse.create",
          entityType: "SchemeCourse",
          entityId: row.id,
          departmentId: programme.departmentId,
          details: data,
        },
        tx,
      );
    });
  },
  "Course saved",
);
courseListsRouter.post("/courses", saveSchemeCourse);
courseListsRouter.put("/courses/:rowId", saveSchemeCourse);

courseListsRouter.delete(
  "/courses/:rowId",
  handle(
    null,
    async (_data, req) => {
      const { actor, scheme, programme } = await context(req);
      const row = await db.schemeCourse.findUnique({ where: { id: req.params.rowId }, include: { course: true } });
      if (!row || row.schemeId !== scheme.id || row.programmeId !== programme.id) {
        throw new NotFoundError("Course row not found.");
      }
      await db.$transaction(async (tx) => {
        await tx.schemeCourse.delete({ where: { id: row.id } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "schemeCourse.delete",
            entityType: "SchemeCourse",
            entityId: row.id,
            departmentId: programme.departmentId,
            details: { code: row.course.code },
          },
          tx,
        );
      });
    },
    "Course removed from the list",
  ),
);

/**
 * Copies the course list (with elective groups, PSOs and, optionally, faculty assignments) from an earlier
 * scheme, typically the one this scheme was cloned from (README §5). Rows that break the new rules are skipped.
 */
courseListsRouter.post(
  "/copy",
  handle(copyCourseListSchema, async ({ fromSchemeId, withAssignments }, req, res) => {
    const { actor, scheme, programme } = await context(req);
    const result = await db.$transaction(async (tx) => {
      const out = await copyCourseList(tx, { scheme, programme, fromSchemeId, withAssignments });
      await writeAudit(
        {
          actorId: actor.id,
          action: "schemeCourse.copy",
          entityType: "Programme",
          entityId: programme.id,
          departmentId: programme.departmentId,
          details: { schemeId: scheme.id, fromSchemeId, ...out },
        },
        tx,
      );
      return out;
    });
    res.locals.message =
      `${result.copied.length} course(s) copied` + (result.skipped.length ? `, ${result.skipped.length} skipped` : "");
    return result;
  }),
);

// --- Elective groups --------------------------------------------------------------------

const saveElectiveGroup = handle(
  electiveGroupSchema,
  async (data, req) => {
    const groupId = req.params.groupId ?? null;
    const { actor, scheme, programme } = await context(req);
    if (groupId) {
      const g = await db.electiveGroup.findUnique({ where: { id: groupId } });
      if (!g || g.schemeId !== scheme.id || g.programmeId !== programme.id) {
        throw new NotFoundError("Elective group not found.");
      }
    }
    await db.$transaction(async (tx) => {
      const row = groupId
        ? await tx.electiveGroup.update({ where: { id: groupId }, data })
        : await tx.electiveGroup.create({ data: { ...data, schemeId: scheme.id, programmeId: programme.id } });
      await writeAudit(
        {
          actorId: actor.id,
          action: groupId ? "electiveGroup.update" : "electiveGroup.create",
          entityType: "ElectiveGroup",
          entityId: row.id,
          departmentId: programme.departmentId,
          details: data,
        },
        tx,
      );
    });
  },
  "Elective group saved",
);
courseListsRouter.post("/elective-groups", saveElectiveGroup);
courseListsRouter.put("/elective-groups/:groupId", saveElectiveGroup);

courseListsRouter.delete(
  "/elective-groups/:groupId",
  handle(
    null,
    async (_data, req) => {
      const { actor, scheme, programme } = await context(req);
      const g = await db.electiveGroup.findUnique({
        where: { id: req.params.groupId },
        include: { _count: { select: { options: true } } },
      });
      if (!g || g.schemeId !== scheme.id || g.programmeId !== programme.id) {
        throw new NotFoundError("Elective group not found.");
      }
      if (g._count.options > 0) throw new UserError("Move or remove the courses in this group first.");
      await db.$transaction(async (tx) => {
        await tx.electiveGroup.delete({ where: { id: g.id } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "electiveGroup.delete",
            entityType: "ElectiveGroup",
            entityId: g.id,
            departmentId: programme.departmentId,
            details: { code: g.code },
          },
          tx,
        );
      });
    },
    "Elective group deleted",
  ),
);

// --- Programme Specific Outcomes --------------------------------------------------------

async function ownedPso(req, scheme, programme) {
  const p = await db.outcomeItem.findUnique({ where: { id: req.params.psoId } });
  if (!p || p.kind !== "PSO" || p.schemeId !== scheme.id || p.programmeId !== programme.id) {
    throw new NotFoundError("PSO not found.");
  }
  return p;
}

const savePso = handle(
  psoSchema,
  async (data, req) => {
    const psoId = req.params.psoId ?? null;
    const { actor, scheme, programme } = await context(req);
    if (psoId) await ownedPso(req, scheme, programme);
    await db.$transaction(async (tx) => {
      const row = psoId
        ? await tx.outcomeItem.update({ where: { id: psoId }, data })
        : await tx.outcomeItem.create({
            data: { ...data, kind: "PSO", schemeId: scheme.id, programmeId: programme.id },
          });
      await writeAudit(
        {
          actorId: actor.id,
          action: psoId ? "pso.update" : "pso.create",
          entityType: "OutcomeItem",
          entityId: row.id,
          departmentId: programme.departmentId,
          details: data,
        },
        tx,
      );
    });
  },
  "PSO saved",
);
courseListsRouter.post("/psos", savePso);
courseListsRouter.put("/psos/:psoId", savePso);

courseListsRouter.delete(
  "/psos/:psoId",
  handle(
    null,
    async (_data, req) => {
      const { actor, scheme, programme } = await context(req);
      const p = await ownedPso(req, scheme, programme);
      await db.$transaction(async (tx) => {
        await tx.outcomeItem.delete({ where: { id: p.id } });
        await writeAudit(
          {
            actorId: actor.id,
            action: "pso.delete",
            entityType: "OutcomeItem",
            entityId: p.id,
            departmentId: programme.departmentId,
            details: { code: p.code },
          },
          tx,
        );
      });
    },
    "PSO deleted",
  ),
);

// --- Excel import -----------------------------------------------------------------------------

courseListsRouter.post(
  "/import",
  (req, res, next) =>
    upload.single("file")(req, res, (err) =>
      err
        ? sendError(res, new UserError(err.code === "LIMIT_FILE_SIZE" ? "The file is larger than 2 MB." : err.message))
        : next(),
    ),
  handle(null, async (_data, req) => {
    const { actor, programme } = await context(req);
    if (!req.file || req.file.size === 0) throw new UserError("Choose an .xlsx file to upload.");
    const list = await getProgrammeCourseList(req.params.schemeId, req.params.programmeId);
    if (!list) throw new NotFoundError("Programme not found.");
    const result = await importCourseWorkbook(list, req.file.buffer);
    if (result.imported > 0) {
      await writeAudit({
        actorId: actor.id,
        action: "schemeCourse.import",
        entityType: "Programme",
        entityId: programme.id,
        departmentId: programme.departmentId,
        details: { schemeId: list.scheme.id, rows: result.imported, file: req.file.originalname },
      });
    }
    return result;
  }),
);
