// Syllabus working copy (Phase 1): open the editor and autosave. Mounted at /api/syllabi
// A syllabus is identified by (scheme, course): one syllabus serves every programme listing the course (D13).
import { Router } from "express";
import { can } from "@acp/shared/domain/auth/permissions";
import { emptyTheoryContent, normalizeTheoryContent } from "@acp/shared/domain/syllabi/theory";
import { validateTheory, validationContext } from "@acp/shared/domain/syllabi/validate";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { saveSyllabusSchema } from "@acp/shared/schemas/syllabus";
import { assertSignedIn } from "../auth/session.js";
import { ConflictError, NotFoundError, PermissionError, UserError } from "../errors.js";
import { handle, sendError } from "../http/handler.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
import { embeddedFontUrl, htmlToPdf, PdfUnavailableError } from "../services/pdf.js";

export const syllabiRouter = Router();

/** Formats with an editor so far. Integrated, project-based and Lab arrive in Phase 3. */
const editableFormats = ["THEORY"];

/** Everything the editor needs, plus what the signed-in user may do. Throws 403/404. */
async function loadContext(req) {
  const user = assertSignedIn(req);
  const { schemeId, courseId } = req.params;
  const [scheme, course, rows, assignments, syllabus] = await Promise.all([
    db.scheme.findUnique({ where: { id: schemeId } }),
    db.course.findUnique({ where: { id: courseId }, include: { owningDepartment: true } }),
    db.schemeCourse.findMany({
      where: { schemeId, courseId },
      include: { programme: true, category: true },
      orderBy: { programme: { code: "asc" } },
    }),
    db.courseAssignment.findMany({
      where: { schemeId, courseId },
      include: { user: { select: { id: true, name: true } } },
      orderBy: { role: "asc" },
    }),
    db.syllabus.findUnique({
      where: { schemeId_courseId: { schemeId, courseId } },
      include: { updatedBy: { select: { name: true } } },
    }),
  ]);
  if (!scheme || !course || rows.length === 0) throw new NotFoundError("This course is not in the scheme.");

  const resource = {
    departmentId: course.owningDepartmentId,
    isAssigned: assignments.some((a) => a.userId === user.id),
  };
  if (!can(user, "syllabus.view", resource)) throw new PermissionError();

  const first = rows[0];
  const formatKey = syllabus?.format ?? first.format ?? first.category.defaultFormat;
  const format = formatKey
    ? await db.formatConfig.findUnique({ where: { schemeId_format: { schemeId, format: formatKey } } })
    : null;

  // Why the syllabus cannot be edited right now (null when it can).
  let lockedReason = null;
  if (!first.category.syllabusRequired) lockedReason = `${first.category.code} courses do not need a syllabus.`;
  else if (scheme.status !== "PUBLISHED")
    lockedReason =
      scheme.status === "DRAFT"
        ? "The scheme is not published yet, so syllabi cannot be framed."
        : "The scheme is retired; its syllabi are read-only.";
  else if (!format) lockedReason = "The course has no syllabus format. Ask the BoS Coordinator to set one.";
  else if (!editableFormats.includes(format.format))
    lockedReason = "The editor for this course format is not available yet (planned for Phase 3).";
  else if (syllabus && syllabus.status !== "DRAFT") lockedReason = "This syllabus has been submitted.";

  return { user, scheme, course, rows, assignments, syllabus, format, resource, lockedReason };
}

/** Everything the editor, the preview and the PDF need (GET /api/syllabi/:schemeId/:courseId). */
async function editorData(req) {
  const { user, scheme, course, rows, assignments, syllabus, format, resource, lockedReason } = await loadContext(req);
  const [institution, outcomes, bloomLevels, textBlocks] = await Promise.all([
    db.institutionSettings.findUnique({ where: { id: 1 } }),
    db.outcomeItem.findMany({
      where: {
        schemeId: scheme.id,
        OR: [{ programmeId: null }, { programmeId: { in: rows.map((r) => r.programmeId) } }],
      },
      orderBy: [{ kind: "asc" }, { sortOrder: "asc" }, { code: "asc" }],
    }),
    db.bloomLevel.findMany({ where: { schemeId: scheme.id }, orderBy: { level: "asc" } }),
    format
      ? db.textBlock.findMany({
          where: { schemeId: scheme.id, OR: [{ format: format.format }, { format: null }] },
          orderBy: [{ kind: "asc" }, { sortOrder: "asc" }],
        })
      : [],
  ]);
  const outcomesOf = (kind) => outcomes.filter((o) => o.kind === kind);

  const data = {
    institution: {
      name: institution?.name ?? "",
      shortName: institution?.shortName ?? null,
      address: institution?.address ?? null,
    },
    scheme: {
      id: scheme.id,
      name: scheme.name,
      status: scheme.status,
      teachingWeeks: scheme.teachingWeeks,
      hoursPerCredit: scheme.hoursPerCredit,
    },
    course: {
      id: course.id,
      code: course.code,
      title: course.title,
      department: { code: course.owningDepartment.code, name: course.owningDepartment.name },
    },
    // One row per programme that lists the course (credits and hours are normally identical).
    offerings: rows.map((r) => ({
      programme: { id: r.programmeId, code: r.programme.code, name: r.programme.name },
      semester: r.semester,
      category: { code: r.category.code, name: r.category.name, passFail: r.category.passFail },
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
    })),
    format,
    lists: {
      pos: outcomesOf("PO"),
      wks: outcomesOf("WK"),
      sdgs: outcomesOf("SDG"),
      psos: rows.map((r) => ({
        programmeCode: r.programme.code,
        items: outcomes.filter((o) => o.kind === "PSO" && o.programmeId === r.programmeId),
      })),
    },
    bloomLevels,
    textBlocks,
    assignments: assignments.map((a) => ({ id: a.id, role: a.role, name: a.user.name, userId: a.user.id })),
    canEdit: !lockedReason && can(user, "syllabus.edit", resource),
    lockedReason,
    syllabus: {
      id: syllabus?.id ?? null,
      status: syllabus?.status ?? "DRAFT",
      revision: syllabus?.revision ?? 0, // 0 = not started; the first save creates it
      updatedAt: syllabus?.updatedAt ?? null,
      updatedBy: syllabus?.updatedBy?.name ?? null,
      content: format
        ? syllabus
          ? normalizeTheoryContent(syllabus.content, format)
          : emptyTheoryContent(format)
        : null,
    },
  };
  // The same rules the editor runs live (README §9); Phase 2 refuses submission while errors remain.
  data.validation = format ? validateTheory(data.syllabus.content, validationContext(data)) : [];
  return data;
}

syllabiRouter.get(
  "/:schemeId/:courseId",
  handle(null, (_data, req) => editorData(req)),
);

/** The saved working copy as a PDF, laid out like the Word template (README §8). */
syllabiRouter.get("/:schemeId/:courseId/pdf", async (req, res) => {
  try {
    const data = await editorData(req);
    if (!data.format) throw new UserError(data.lockedReason ?? "This course has no syllabus format.");
    const html = syllabusHtml(data, data.syllabus.content, { fontUrl: await embeddedFontUrl() });
    const pdf = await htmlToPdf(html);
    const fileName = `${data.course.code}_syllabus_draft.pdf`.replace(/[^\w.-]/g, "_");
    res.set({
      "Content-Type": "application/pdf",
      "Content-Disposition": `${req.query.download === "1" ? "attachment" : "inline"}; filename="${fileName}"`,
      "Cache-Control": "no-store",
    });
    res.send(pdf);
  } catch (e) {
    if (e instanceof PdfUnavailableError) {
      return res.status(503).json({ ok: false, error: e.message, code: "PDF_UNAVAILABLE" });
    }
    sendError(res, e);
  }
});

/**
 * Autosave. `revision` is the revision the editor started from: if someone saved in between, the
 * save is refused (409) with the newer copy, so nobody silently overwrites a colleague's work.
 */
syllabiRouter.put(
  "/:schemeId/:courseId",
  handle(saveSyllabusSchema, async ({ revision, content }, req) => {
    const { user, scheme, course, syllabus, format, resource, lockedReason } = await loadContext(req);
    if (!can(user, "syllabus.edit", resource)) throw new PermissionError();
    if (lockedReason) throw new UserError(lockedReason);

    const conflict = async () => {
      const latest = await db.syllabus.findUnique({
        where: { schemeId_courseId: { schemeId: scheme.id, courseId: course.id } },
        include: { updatedBy: { select: { name: true } } },
      });
      return new ConflictError(
        `${latest?.updatedBy?.name ?? "Someone else"} saved this syllabus while you were editing. Load their version to continue.`,
        latest && {
          revision: latest.revision,
          updatedAt: latest.updatedAt,
          updatedBy: latest.updatedBy?.name ?? null,
          content: normalizeTheoryContent(latest.content, format),
        },
      );
    };

    if (!syllabus) {
      if (revision !== 0) throw await conflict();
      try {
        const created = await db.$transaction(async (tx) => {
          const row = await tx.syllabus.create({
            data: {
              schemeId: scheme.id,
              courseId: course.id,
              format: format.format,
              content,
              revision: 1,
              updatedById: user.id,
            },
          });
          await writeAudit(
            {
              actorId: user.id,
              action: "syllabus.create",
              entityType: "Syllabus",
              entityId: row.id,
              departmentId: course.owningDepartmentId,
              details: { schemeId: scheme.id, courseCode: course.code },
            },
            tx,
          );
          return row;
        });
        return { revision: created.revision, updatedAt: created.updatedAt };
      } catch (e) {
        if (e?.code === "P2002") throw await conflict(); // a colleague created it at the same moment
        throw e;
      }
    }

    // Compare-and-set on the revision: only one of two simultaneous saves can win.
    const { count } = await db.syllabus.updateMany({
      where: { id: syllabus.id, revision },
      data: { content, revision: { increment: 1 }, updatedById: user.id },
    });
    if (count === 0) throw await conflict();
    const saved = await db.syllabus.findUnique({
      where: { id: syllabus.id },
      select: { revision: true, updatedAt: true },
    });
    return saved;
  }),
);
