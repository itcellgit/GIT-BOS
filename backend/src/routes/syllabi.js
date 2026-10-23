// Syllabus working copy: open the editor, autosave, PDF. Mounted at /api/syllabi
// Versions and the review workflow are in reviews.js.
// A syllabus is identified by (scheme, course): one syllabus serves every programme listing the course (D13).
import { Router } from "express";
import { can } from "@acp/shared/domain/auth/permissions";
import { normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { saveSyllabusSchema } from "@acp/shared/schemas/syllabus";
import { ConflictError, PermissionError, UserError } from "../errors.js";
import { handle } from "../http/handler.js";
import { pdfRoute } from "../http/pdf.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
import { loadContext, loadEditorData } from "../services/syllabi.js";

export const syllabiRouter = Router();

syllabiRouter.get(
  "/:schemeId/:courseId",
  handle(null, async (_data, req) => (await loadEditorData(req)).data),
);

/** The saved working copy as a PDF, laid out like the Word template (README §8). */
syllabiRouter.get(
  "/:schemeId/:courseId/pdf",
  pdfRoute(async (req, fontUrl) => {
    const { data } = await loadEditorData(req);
    if (!data.format) throw new UserError(data.lockedReason ?? "This course has no syllabus format.");
    return {
      html: syllabusHtml(data, data.syllabus.content, { fontUrl }),
      fileName: `${data.course.code}_syllabus_draft.pdf`,
    };
  }),
);

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
          content: normalizeSyllabusContent(latest.content, format),
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
