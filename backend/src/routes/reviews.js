// Versions and the BOS review workflow (Phase 2, README §7). Mounted at /api/syllabi/:schemeId/:courseId
//   submit → V1.0 · save version → next minor · close stage → V2.0 / V3.0 / V4.0 · unlock · re-approve
//   review inputs (BoS Coordinator) and the action taken on each (Course Coordinator)
// Every change runs in one transaction with its audit record; versions are never changed afterwards.
import { Router } from "express";
import { can } from "@acp/shared/domain/auth/permissions";
import {
  nextVersion,
  sectionRefOptions,
  stageAfter,
  stages,
  versionLabel,
  versionStatusLabel,
  workflowBlocker,
} from "@acp/shared/domain/reviews/workflow";
import { normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { actionTakenHtml } from "@acp/shared/print/action-taken-document";
import { syllabusHtml } from "@acp/shared/print/syllabus-document";
import {
  actionTakenSchema,
  approvalSchema,
  closeStageSchema,
  commitVersionSchema,
  expertLinkSchema,
  reviewInputSchema,
  unlockSchema,
} from "@acp/shared/schemas/review";
import { ConflictError, NotFoundError, PermissionError, UserError } from "../errors.js";
import { handle, zodFieldErrors } from "../http/handler.js";
import { pdfRoute } from "../http/pdf.js";
import { db } from "../infra/db.js";
import { writeAudit } from "../services/audit.js";
import { frozenSyllabusPdf, isApprovedVersion } from "../services/documents.js";
import { expertLinkUrl, linkStatus, newToken } from "../services/expert-links.js";
import { sendMail } from "../infra/mail.js";
import { buildEditorData, loadEditorData, loadSyllabusContext, workflowBlockers } from "../services/syllabi.js";

export const reviewsRouter = Router({ mergeParams: true });

// --- Loading ------------------------------------------------------------------------------------

/** Editor data plus the checks for a workflow change. `need`: "edit" (faculty) or "review" (BoS). */
async function loadFor(req, need) {
  const { ctx, data } = await loadEditorData(req);
  const { user, resource, syllabus, lockedReason } = ctx;
  if (need === "review") {
    if (!data.canReview) throw new PermissionError();
  } else if (need === "edit") {
    if (!can(user, "syllabus.edit", resource)) throw new PermissionError();
    if (lockedReason) throw new UserError(lockedReason);
  }
  if (need && !syllabus) throw new UserError("Nothing has been saved yet.");
  return { ...ctx, data };
}

/** Throws a UserError with the reason `action` is not possible now. */
function assertAllowed(action, state) {
  const blocker = workflowBlocker(action, state);
  if (blocker) throw new UserError(blocker);
}

const reviewerSelect = { id: true, name: true, category: true, designation: true, organisation: true };
const meetingSelect = { id: true, stage: true, heldAt: true, venue: true, title: true };

async function latestVersion(syllabusId, tx = db) {
  return tx.syllabusVersion.findFirst({
    where: { syllabusId },
    orderBy: [{ major: "desc" }, { minor: "desc" }],
  });
}

/** Review page data: versions, inputs, meetings to choose from, reviewers, unlocks and approvals. */
async function reviewData(req) {
  const { user, resource, syllabus, course, scheme, rows, data } = await loadFor(req, null);
  const [versions, inputs, meetings, reviewers, unlocks, approvals, expertLinks] = syllabus
    ? await Promise.all([
        db.syllabusVersion.findMany({
          where: { syllabusId: syllabus.id },
          orderBy: [{ major: "desc" }, { minor: "desc" }],
          select: {
            id: true,
            label: true,
            major: true,
            minor: true,
            stage: true,
            source: true,
            reason: true,
            createdAt: true,
            createdBy: { select: { name: true } },
          },
        }),
        db.reviewInput.findMany({
          where: { syllabusId: syllabus.id },
          orderBy: [{ createdAt: "asc" }],
          include: {
            givenBy: { select: reviewerSelect },
            meeting: { select: meetingSelect },
            reviewedVersion: { select: { label: true } },
            resultingVersion: { select: { label: true } },
            respondedBy: { select: { name: true } },
          },
        }),
        db.reviewMeeting.findMany({
          where: { departmentId: course.owningDepartmentId, schemeId: scheme.id },
          orderBy: { heldAt: "desc" },
          select: meetingSelect,
        }),
        db.reviewer.findMany({
          where: { departmentId: course.owningDepartmentId, isActive: true },
          orderBy: [{ category: "asc" }, { name: "asc" }],
          select: reviewerSelect,
        }),
        db.syllabusUnlock.findMany({
          where: { syllabusId: syllabus.id },
          orderBy: { createdAt: "asc" },
          include: { createdBy: { select: { name: true } } },
        }),
        db.syllabusApproval.findMany({
          where: { syllabusId: syllabus.id },
          orderBy: { createdAt: "asc" },
          include: { version: { select: { label: true } }, recordedBy: { select: { name: true } } },
        }),
        db.expertLink.findMany({
          where: { syllabusId: syllabus.id },
          orderBy: { createdAt: "desc" },
          include: {
            reviewer: { select: reviewerSelect },
            version: { select: { label: true } },
            createdBy: { select: { name: true } },
            _count: { select: { comments: true } },
          },
        }),
      ])
    : [[], [], [], [], [], [], []];

  return {
    institution: data.institution,
    scheme: { id: scheme.id, name: scheme.name },
    course: { id: course.id, code: course.code, title: course.title, department: data.course.department },
    semesters: [...new Set(rows.map((r) => r.semester))].sort((a, b) => a - b),
    syllabus: {
      id: syllabus?.id ?? null,
      status: data.syllabus.status,
      officialVersion: data.syllabus.officialVersion,
    },
    workflow: data.workflow,
    blockers: workflowBlockers(data.workflow),
    canReview: data.canReview,
    // Responding to inputs is part of editing the working copy (README §4).
    canRespond: data.canEdit && can(user, "syllabus.edit", resource),
    canEdit: data.canEdit,
    sectionRefs: sectionRefOptions(data.syllabus.content),
    versions: versions.map((v) => ({
      ...v,
      createdBy: v.createdBy?.name ?? null,
      statusLabel: versionStatusLabel(v, { official: v.id === syllabus?.officialVersionId }),
      official: v.id === syllabus?.officialVersionId,
    })),
    inputs: inputs.map((i) => ({
      id: i.id,
      stage: i.stage,
      sectionRef: i.sectionRef,
      inputText: i.inputText,
      givenBy: i.givenBy,
      meeting: i.meeting,
      actionTaken: i.actionTaken,
      decision: i.decision,
      respondedBy: i.respondedBy?.name ?? null,
      reviewedLabel: i.reviewedVersion.label,
      resultingLabel: i.resultingVersion?.label ?? null,
      createdAt: i.createdAt,
      viaLink: !!i.expertLinkId,
      // Inputs of a closed stage are part of the record and can no longer change.
      open: data.workflow.status === "IN_REVIEW" && i.stage === data.workflow.stage,
    })),
    meetings,
    reviewers,
    unlocks: unlocks.map((u) => ({
      id: u.id,
      stage: u.stage,
      fromLabel: u.fromLabel,
      reason: u.reason,
      createdAt: u.createdAt,
      by: u.createdBy?.name ?? null,
    })),
    approvals: approvals.map((a) => ({
      id: a.id,
      versionLabel: a.version.label,
      approvedOn: a.approvedOn,
      reference: a.reference,
      by: a.recordedBy?.name ?? null,
      createdAt: a.createdAt,
    })),
    // The token is never stored, so a link cannot be shown again; it can be revoked and reissued.
    expertLinks: expertLinks.map((l) => ({
      id: l.id,
      reviewer: l.reviewer,
      versionLabel: l.version.label,
      expiresAt: l.expiresAt,
      revokedAt: l.revokedAt,
      lastUsedAt: l.lastUsedAt,
      status: linkStatus(l),
      commentCount: l._count.comments,
      createdBy: l.createdBy?.name ?? null,
      createdAt: l.createdAt,
    })),
  };
}

reviewsRouter.get(
  "/review",
  handle(null, (_data, req) => reviewData(req)),
);

// --- Workflow changes ---------------------------------------------------------------------------------

/** Freezes the saved working copy as a new version. */
function createVersion(tx, { syllabus, version, stage, source, reason, userId }) {
  return tx.syllabusVersion.create({
    data: {
      syllabusId: syllabus.id,
      major: version.major,
      minor: version.minor,
      label: versionLabel(version.major, version.minor),
      stage,
      source,
      reason: reason ?? null,
      content: syllabus.content,
      revision: syllabus.revision,
      createdById: userId,
    },
  });
}

/**
 * Moves the syllabus to its next state, but only if nobody changed it since it was loaded (an
 * autosave or a colleague's workflow action); otherwise the whole transaction is rolled back.
 */
async function moveSyllabus(tx, syllabus, data) {
  const { count } = await tx.syllabus.updateMany({
    where: {
      id: syllabus.id,
      revision: syllabus.revision,
      status: syllabus.status,
      majorVersion: syllabus.majorVersion,
      minorVersion: syllabus.minorVersion,
    },
    data,
  });
  if (count === 0) {
    throw new ConflictError("The syllabus changed while you were working. Reload the page and try again.");
  }
}

/** Inputs of the current stage that were answered are recorded as incorporated in `versionId`. */
function linkAnsweredInputs(tx, syllabus, versionId) {
  return tx.reviewInput.updateMany({
    where: {
      syllabusId: syllabus.id,
      stage: syllabus.stage ?? undefined,
      resultingVersionId: null,
      decision: { in: ["ACCEPTED", "PARTLY"] },
      actionTaken: { not: null },
    },
    data: { resultingVersionId: versionId },
  });
}

const audit = (tx, ctx, action, details) =>
  writeAudit(
    {
      actorId: ctx.user.id,
      action,
      entityType: "Syllabus",
      entityId: ctx.syllabus.id,
      departmentId: ctx.course.owningDepartmentId,
      details: { courseCode: ctx.course.code, schemeId: ctx.scheme.id, ...details },
    },
    tx,
  );

/** First submission: V1.0, and the syllabus goes to the Internal BOS. */
reviewsRouter.post(
  "/submit",
  handle(
    null,
    async (_data, req) => {
      const ctx = await loadFor(req, "edit");
      const { syllabus, user, data } = ctx;
      assertAllowed("submit", data.workflow);
      const version = nextVersion(data.workflow, "submit");
      await db.$transaction(async (tx) => {
        const v = await createVersion(tx, {
          syllabus,
          version,
          stage: "INTERNAL_BOS",
          source: "SUBMIT",
          reason: "First submission",
          userId: user.id,
        });
        await moveSyllabus(tx, syllabus, {
          status: "IN_REVIEW",
          stage: "INTERNAL_BOS",
          majorVersion: version.major,
          minorVersion: version.minor,
          committedRevision: syllabus.revision,
        });
        await audit(tx, ctx, "syllabus.submit", { version: v.label });
      });
      return { label: versionLabel(version.major, version.minor) };
    },
    "Submitted as V1.0 for the Internal BOS",
  ),
);

/** "Save version": the changes since the last version become the next minor version. */
reviewsRouter.post(
  "/versions",
  handle(commitVersionSchema, async ({ reason }, req, res) => {
    const ctx = await loadFor(req, "edit");
    const { syllabus, user, data } = ctx;
    assertAllowed("commit", data.workflow);
    const version = nextVersion(data.workflow, "commit");
    const label = await db.$transaction(async (tx) => {
      const v = await createVersion(tx, {
        syllabus,
        version,
        stage: syllabus.stage,
        source: "COMMIT",
        reason,
        userId: user.id,
      });
      await moveSyllabus(tx, syllabus, { minorVersion: version.minor, committedRevision: syllabus.revision });
      if (syllabus.status === "IN_REVIEW") await linkAnsweredInputs(tx, syllabus, v.id);
      await audit(tx, ctx, "syllabus.commit", { version: v.label, reason });
      return v.label;
    });
    res.locals.message = `Saved as ${label}`;
    return { label };
  }),
);

/** Records the Academic Council decision: the version becomes official and the copy is locked. */
/**
 * Freezes the approved version's PDF right after the approval commits, so it is made with the layout
 * in force at approval. If no PDF engine is available it is frozen at the first download instead.
 */
function freezeAfterApproval(ctx, versionId) {
  setImmediate(async () => {
    try {
      const v = await db.syllabusVersion.findUnique({ where: { id: versionId } });
      const { data } = await buildEditorData(await loadSyllabusContext(null, ctx.scheme.id, ctx.course.id));
      await frozenSyllabusPdf(data, v, normalizeSyllabusContent(v.content, ctx.format));
    } catch (e) {
      console.warn(
        `[pdf] could not freeze ${ctx.course.code} on approval; it will be frozen at first download:`,
        e.message,
      );
    }
  });
}

async function recordApproval(tx, ctx, versionId, { approvedOn, reference }) {
  await tx.syllabusApproval.create({
    data: {
      syllabusId: ctx.syllabus.id,
      versionId,
      approvedOn: new Date(`${approvedOn}T00:00:00Z`),
      reference,
      recordedById: ctx.user.id,
    },
  });
}

/** Closes the current stage (BoS Coordinator). Refused while any input of the stage is pending. */
reviewsRouter.post(
  "/close",
  handle(null, async (body, req, res) => {
    const ctx = await loadFor(req, "review");
    const { syllabus, user, data } = ctx;
    const finalStage = syllabus.stage === "ACADEMIC_COUNCIL";
    const parsed = (finalStage ? approvalSchema : closeStageSchema).safeParse(body ?? {});
    if (!parsed.success) throw new UserError("Please correct the highlighted fields.", zodFieldErrors(parsed.error));
    assertAllowed("close", data.workflow);

    const version = nextVersion(data.workflow, "close");
    const next = stageAfter(syllabus.stage);
    const { label, versionId } = await db.$transaction(async (tx) => {
      let v = null;
      if (version) {
        v = await createVersion(tx, {
          syllabus,
          version,
          stage: next,
          source: "CLOSE_STAGE",
          reason: parsed.data.reason ?? `${syllabus.stage === "EXPERT" ? "Expert" : "Stage"} inputs incorporated`,
          userId: user.id,
        });
        await linkAnsweredInputs(tx, syllabus, v.id);
      }
      await moveSyllabus(tx, syllabus, {
        status: finalStage ? "APPROVED" : "IN_REVIEW",
        stage: next,
        ...(version
          ? { majorVersion: version.major, minorVersion: version.minor, committedRevision: syllabus.revision }
          : {}),
        ...(finalStage ? { officialVersionId: v.id } : {}),
      });
      if (finalStage) await recordApproval(tx, ctx, v.id, parsed.data);
      await audit(tx, ctx, "syllabus.closeStage", {
        stage: syllabus.stage,
        version: v?.label ?? null,
        ...(finalStage ? { approvedOn: parsed.data.approvedOn, reference: parsed.data.reference } : {}),
      });
      return { label: v?.label ?? data.workflow.label, versionId: v?.id };
    });
    if (finalStage) freezeAfterApproval(ctx, versionId);
    res.locals.message = finalStage
      ? `Approved: ${label} is the official syllabus`
      : `Stage closed. The syllabus (${label}) moves to the ${next === "EXPERT" ? "expert review" : "next stage"}.`;
    return { label, stage: next };
  }),
);

/** Unlocks an approved syllabus for a correction (D5). The approved version stays official. */
reviewsRouter.post(
  "/unlock",
  handle(
    unlockSchema,
    async ({ reason }, req) => {
      const ctx = await loadFor(req, "review");
      const { syllabus, user, data } = ctx;
      assertAllowed("unlock", data.workflow);
      await db.$transaction(async (tx) => {
        await moveSyllabus(tx, syllabus, { status: "REVISING" });
        await tx.syllabusUnlock.create({
          data: {
            syllabusId: syllabus.id,
            stage: "ACADEMIC_COUNCIL",
            fromLabel: syllabus.officialVersion?.label ?? data.workflow.label,
            reason,
            createdById: user.id,
          },
        });
        await audit(tx, ctx, "syllabus.unlock", { from: syllabus.officialVersion?.label, reason });
      });
    },
    "Unlocked. The approved version stays official until the correction is approved.",
  ),
);

/** Re-approval after an unlock: uncommitted changes become a minor version, which becomes official. */
reviewsRouter.post(
  "/approve",
  handle(approvalSchema, async (body, req, res) => {
    const ctx = await loadFor(req, "review");
    const { syllabus, user, data } = ctx;
    assertAllowed("approve", data.workflow);
    const version = nextVersion(data.workflow, "approve");
    const { label, versionId } = await db.$transaction(async (tx) => {
      const v = version
        ? await createVersion(tx, {
            syllabus,
            version,
            stage: null,
            source: "APPROVE",
            reason: body.reason ?? "Correction approved",
            userId: user.id,
          })
        : await latestVersion(syllabus.id, tx);
      await moveSyllabus(tx, syllabus, {
        status: "APPROVED",
        stage: null,
        officialVersionId: v.id,
        ...(version ? { minorVersion: version.minor, committedRevision: syllabus.revision } : {}),
      });
      await recordApproval(tx, ctx, v.id, body);
      await audit(tx, ctx, "syllabus.approve", { version: v.label, reference: body.reference });
      return { label: v.label, versionId: v.id };
    });
    freezeAfterApproval(ctx, versionId);
    res.locals.message = `Approved: ${label} is the official syllabus`;
    return { label };
  }),
);

// --- Versions ------------------------------------------------------------------------------------------

async function loadVersion(req) {
  const { syllabus, format, data } = await loadFor(req, null);
  const v = syllabus
    ? await db.syllabusVersion.findFirst({
        where: { id: req.params.versionId, syllabusId: syllabus.id },
        include: { createdBy: { select: { name: true } } },
      })
    : null;
  if (!v) throw new NotFoundError("Version not found.");
  const official = v.id === syllabus.officialVersionId;
  return {
    data,
    version: {
      id: v.id,
      label: v.label,
      major: v.major,
      minor: v.minor,
      stage: v.stage,
      source: v.source,
      reason: v.reason,
      createdAt: v.createdAt,
      createdBy: v.createdBy?.name ?? null,
      official,
      statusLabel: versionStatusLabel(v, { official }),
    },
    content: normalizeSyllabusContent(v.content, format),
  };
}

reviewsRouter.get(
  "/versions/:versionId",
  handle(null, async (_data, req) => {
    const { version, content } = await loadVersion(req);
    return { version, content };
  }),
);

reviewsRouter.get(
  "/versions/:versionId/pdf",
  pdfRoute(async (req, fontUrl) => {
    const { data, version, content } = await loadVersion(req);
    const fileName = `${data.course.code}_syllabus_${version.label}.pdf`;
    // An approved version always prints from its frozen PDF (README §8).
    if (await isApprovedVersion(version.id)) {
      const doc = await frozenSyllabusPdf(data, version, content);
      return {
        pdf: Buffer.from(doc.pdf),
        fileName,
        headers: { "X-Document-SHA256": doc.sha256, "X-Layout-Version": String(doc.layoutVersion) },
      };
    }
    return {
      html: syllabusHtml(data, content, { fontUrl, status: { label: version.statusLabel, draft: false } }),
      fileName,
    };
  }),
);

// --- Action Taken report -------------------------------------------------------------------------------

reviewsRouter.get(
  "/action-taken/:stage/pdf",
  pdfRoute(async (req, fontUrl) => {
    const stage = req.params.stage;
    if (!stages.includes(stage)) throw new NotFoundError("Unknown stage.");
    const review = await reviewData(req);
    return {
      html: actionTakenHtml(review, stage, { fontUrl }),
      fileName: `${review.course.code}_action_taken_${stage.toLowerCase()}.pdf`,
    };
  }),
);

// --- Review inputs -------------------------------------------------------------------------------------

/** An input of this syllabus that can still change (its stage is the current one). */
async function openInput(ctx, inputId) {
  const input = await db.reviewInput.findFirst({ where: { id: inputId, syllabusId: ctx.syllabus.id } });
  if (!input) throw new NotFoundError("Input not found.");
  if (ctx.syllabus.status !== "IN_REVIEW" || input.stage !== ctx.syllabus.stage) {
    throw new UserError("This input belongs to a closed stage and can no longer change.");
  }
  return input;
}

/** The reviewer and meeting must belong to the course's department (and the meeting to this stage). */
async function checkInputLinks(ctx, { givenById, meetingId }) {
  const fieldErrors = {};
  if (givenById) {
    const r = await db.reviewer.findUnique({ where: { id: givenById } });
    if (!r || r.departmentId !== ctx.course.owningDepartmentId)
      fieldErrors.givenById = "Choose a reviewer of the department";
  }
  if (meetingId) {
    const m = await db.reviewMeeting.findUnique({ where: { id: meetingId } });
    if (!m || m.departmentId !== ctx.course.owningDepartmentId || m.schemeId !== ctx.scheme.id)
      fieldErrors.meetingId = "Choose a meeting of the department";
    else if (m.stage !== ctx.syllabus.stage) fieldErrors.meetingId = "This meeting is for another stage";
  }
  if (Object.keys(fieldErrors).length) throw new UserError("Please correct the highlighted fields.", fieldErrors);
}

reviewsRouter.post(
  "/inputs",
  handle(
    reviewInputSchema,
    async (body, req) => {
      const ctx = await loadFor(req, "review");
      const { syllabus, user } = ctx;
      if (syllabus.status !== "IN_REVIEW") throw new UserError("Inputs can be recorded only during a review stage.");
      await checkInputLinks(ctx, body);
      await db.$transaction(async (tx) => {
        const reviewed = await latestVersion(syllabus.id, tx);
        const input = await tx.reviewInput.create({
          data: {
            ...body,
            syllabusId: syllabus.id,
            stage: syllabus.stage,
            reviewedVersionId: reviewed.id,
            createdById: user.id,
          },
        });
        await audit(tx, ctx, "reviewInput.create", {
          inputId: input.id,
          stage: syllabus.stage,
          section: body.sectionRef,
        });
      });
    },
    "Input recorded",
  ),
);

reviewsRouter.put(
  "/inputs/:inputId",
  handle(
    reviewInputSchema,
    async (body, req) => {
      const ctx = await loadFor(req, "review");
      const input = await openInput(ctx, req.params.inputId);
      await checkInputLinks(ctx, body);
      await db.$transaction(async (tx) => {
        await tx.reviewInput.update({ where: { id: input.id }, data: body });
        await audit(tx, ctx, "reviewInput.update", { inputId: input.id });
      });
    },
    "Input updated",
  ),
);

reviewsRouter.delete(
  "/inputs/:inputId",
  handle(
    null,
    async (_data, req) => {
      const ctx = await loadFor(req, "review");
      const input = await openInput(ctx, req.params.inputId);
      if (input.resultingVersionId) throw new UserError("This input is already incorporated in a version.");
      await db.$transaction(async (tx) => {
        await tx.reviewInput.delete({ where: { id: input.id } });
        await audit(tx, ctx, "reviewInput.delete", { inputId: input.id, text: input.inputText.slice(0, 200) });
      });
    },
    "Input removed",
  ),
);

/** The action taken on an input and the decision (Course Coordinator or BoS Coordinator). */
reviewsRouter.put(
  "/inputs/:inputId/action",
  handle(
    actionTakenSchema,
    async (body, req) => {
      const ctx = await loadFor(req, "edit");
      const input = await openInput(ctx, req.params.inputId);
      await db.$transaction(async (tx) => {
        await tx.reviewInput.update({ where: { id: input.id }, data: { ...body, respondedById: ctx.user.id } });
        await audit(tx, ctx, "reviewInput.respond", { inputId: input.id, decision: body.decision });
      });
    },
    "Action taken saved",
  ),
);

// --- Expert review links (README §7, rule 6) ---------------------------------------------------------

/** Issues a link for one expert to review the current version. The link is returned only this once. */
reviewsRouter.post(
  "/expert-links",
  handle(expertLinkSchema, async ({ reviewerId, days, sendEmail }, req, res) => {
    const ctx = await loadFor(req, "review");
    const { syllabus, course, user } = ctx;
    if (syllabus.status !== "IN_REVIEW" || syllabus.stage !== "EXPERT") {
      throw new UserError("Expert links can be issued only during the Industry Experts & Alumni stage.");
    }
    const reviewer = await db.reviewer.findUnique({ where: { id: reviewerId } });
    if (!reviewer || reviewer.departmentId !== course.owningDepartmentId || !reviewer.isActive) {
      throw new UserError("Choose an active reviewer of the department.", {
        reviewerId: "Not a reviewer of the department",
      });
    }
    if (sendEmail && !reviewer.email) {
      throw new UserError("This reviewer has no email address.", {
        sendEmail: "Add an email address to the reviewer first",
      });
    }
    const version = await latestVersion(syllabus.id);
    const active = await db.expertLink.findFirst({
      where: { versionId: version.id, reviewerId, revokedAt: null, expiresAt: { gt: new Date() } },
    });
    if (active) {
      throw new UserError(
        `${reviewer.name} already has an active link for ${version.label}. Revoke it first to issue a new one.`,
      );
    }

    const { token, tokenHash } = newToken();
    const expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    const link = await db.$transaction(async (tx) => {
      const row = await tx.expertLink.create({
        data: {
          syllabusId: syllabus.id,
          versionId: version.id,
          reviewerId,
          tokenHash,
          expiresAt,
          createdById: user.id,
        },
      });
      await audit(tx, ctx, "expertLink.issue", {
        linkId: row.id,
        reviewer: reviewer.name,
        version: version.label,
        expiresAt,
      });
      return row;
    });
    const url = expertLinkUrl(token);
    if (sendEmail) {
      const until = expiresAt.toLocaleDateString("en-IN", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        timeZone: "Asia/Kolkata",
      });
      await sendMail({
        to: reviewer.email,
        subject: `Syllabus review: ${course.code} ${course.title} (${version.label})`,
        text: `Dear ${reviewer.name},

You are invited to review the syllabus of ${course.code} ${course.title} (${version.label}). Open the link below to read it and add your comments against each unit or section. No sign-in is needed.

${url}

The link is personal and works until ${until}.

${user.name}
BoS Coordinator`,
      });
    }
    res.locals.message = sendEmail
      ? `Link emailed to ${reviewer.email}`
      : "Link issued. Copy it now: it is shown only once.";
    return { id: link.id, url, expiresAt };
  }),
);

reviewsRouter.post(
  "/expert-links/:linkId/revoke",
  handle(
    null,
    async (_data, req) => {
      const ctx = await loadFor(req, "review");
      const link = await db.expertLink.findFirst({ where: { id: req.params.linkId, syllabusId: ctx.syllabus.id } });
      if (!link) throw new NotFoundError("Link not found.");
      if (link.revokedAt) throw new UserError("This link has already been revoked.");
      await db.$transaction(async (tx) => {
        await tx.expertLink.update({ where: { id: link.id }, data: { revokedAt: new Date() } });
        await audit(tx, ctx, "expertLink.revoke", { linkId: link.id });
      });
    },
    "Link revoked. It no longer opens the syllabus.",
  ),
);
