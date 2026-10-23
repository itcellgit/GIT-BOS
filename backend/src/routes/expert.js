// The expert's review page (README §7, rule 6). No sign-in: the link's token is the credential.
// The expert sees one version read-only and comments against its units and sections; each comment
// becomes a ReviewInput of the expert stage, given by that expert. Mounted at /api/expert
import { Router } from "express";
import { sectionRefOptions, versionStatusLabel } from "@acp/shared/domain/reviews/workflow";
import { normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import { expertCommentSchema } from "@acp/shared/schemas/review";
import { NotFoundError, UserError } from "../errors.js";
import { handle } from "../http/handler.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
import { openExpertLink } from "../services/expert-links.js";
import { buildEditorData, loadSyllabusContext } from "../services/syllabi.js";

export const expertRouter = Router();

// The token is the only credential: keep these pages out of caches and referrers.
expertRouter.use((_req, res, next) => {
  res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" });
  next();
});

const closedMessage = "The expert review of this syllabus has closed, so comments can no longer be added or removed.";

async function comments(linkId) {
  return db.reviewInput.findMany({
    where: { expertLinkId: linkId },
    orderBy: { createdAt: "asc" },
    select: { id: true, sectionRef: true, inputText: true, actionTaken: true, createdAt: true },
  });
}

expertRouter.get(
  "/:token",
  handle(null, async (_data, req) => {
    const { link, open } = await openExpertLink(req.params.token);
    const ctx = await loadSyllabusContext(null, link.syllabus.schemeId, link.syllabus.courseId);
    const { data } = await buildEditorData(ctx);
    const content = normalizeSyllabusContent(link.version.content, ctx.format);
    await db.expertLink.update({ where: { id: link.id }, data: { lastUsedAt: new Date() } });
    return {
      reviewer: { name: link.reviewer.name },
      institution: { name: data.institution.name },
      course: { code: data.course.code, title: data.course.title, department: data.course.department.name },
      scheme: { name: data.scheme.name },
      version: { label: link.version.label, statusLabel: versionStatusLabel(link.version) },
      expiresAt: link.expiresAt,
      open,
      sectionRefs: sectionRefOptions(content),
      comments: await comments(link.id),
      html: syllabusHtml(data, content, { status: { label: versionStatusLabel(link.version), draft: false } }),
    };
  }),
);

expertRouter.post(
  "/:token/comments",
  handle(
    expertCommentSchema,
    async (body, req) => {
      const { link, open } = await openExpertLink(req.params.token);
      if (!open) throw new UserError(closedMessage);
      await db.$transaction(async (tx) => {
        const input = await tx.reviewInput.create({
          data: {
            ...body,
            syllabusId: link.syllabusId,
            stage: "EXPERT",
            reviewedVersionId: link.versionId,
            givenById: link.reviewerId,
            expertLinkId: link.id,
          },
        });
        await writeAudit(
          {
            actorId: null,
            action: "expert.comment",
            entityType: "ReviewInput",
            entityId: input.id,
            departmentId: link.reviewer.departmentId,
            details: { linkId: link.id, reviewer: link.reviewer.name, section: body.sectionRef },
          },
          tx,
        );
      });
    },
    "Comment saved. Thank you.",
  ),
);

expertRouter.delete(
  "/:token/comments/:inputId",
  handle(
    null,
    async (_data, req) => {
      const { link, open } = await openExpertLink(req.params.token);
      if (!open) throw new UserError(closedMessage);
      const input = await db.reviewInput.findFirst({ where: { id: req.params.inputId, expertLinkId: link.id } });
      if (!input) throw new NotFoundError("Comment not found.");
      if (input.actionTaken) throw new UserError("The course team has already responded to this comment.");
      await db.$transaction(async (tx) => {
        await tx.reviewInput.delete({ where: { id: input.id } });
        await writeAudit(
          {
            actorId: null,
            action: "expert.commentDelete",
            entityType: "ReviewInput",
            entityId: input.id,
            departmentId: link.reviewer.departmentId,
            details: { linkId: link.id },
          },
          tx,
        );
      });
    },
    "Comment removed",
  ),
);
