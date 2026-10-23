// Loading a syllabus with everything around it: the scheme rows, the format, the people assigned,
// permissions, and its place in the review workflow. Used by the editor routes and the review routes.
import { can } from "@acp/shared/domain/auth/permissions";
import { pendingInputs, versionLabel, workflowBlocker } from "@acp/shared/domain/reviews/workflow";
import { emptySyllabusContent, normalizeSyllabusContent } from "@acp/shared/domain/syllabi/content";
import { summarizeIssues, validateSyllabus, validationContext } from "@acp/shared/domain/syllabi/validate";
import { assertSignedIn } from "../auth/session.js";
import { carryForwardSources } from "./carry-forward.js";
import { NotFoundError, PermissionError } from "../errors.js";
import { db } from "../infra/db.js";

/** Formats with an editor (all four since Phase 3). */
const editableFormats = ["THEORY", "INTEGRATED", "INTEGRATED_PROJECT", "LAB"];

/** Everything the editor needs, plus what the signed-in user may do. Throws 403/404. */
export function loadContext(req) {
  const user = assertSignedIn(req);
  return loadSyllabusContext(user, req.params.schemeId, req.params.courseId);
}

/**
 * Loads a syllabus and its surroundings. `user` null is only for callers that have authorised the
 * request another way (an expert's review link): then no permission is checked and nothing is editable.
 */
export async function loadSyllabusContext(user, schemeId, courseId) {
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
      include: {
        updatedBy: { select: { name: true } },
        officialVersion: { select: { id: true, label: true, createdAt: true } },
        carriedFrom: {
          select: {
            label: true,
            syllabus: { select: { scheme: { select: { name: true } }, course: { select: { code: true } } } },
          },
        },
      },
    }),
  ]);
  if (!scheme || !course || rows.length === 0) throw new NotFoundError("This course is not in the scheme.");

  const resource = {
    departmentId: course.owningDepartmentId,
    isAssigned: !!user && assignments.some((a) => a.userId === user.id),
  };
  if (user && !can(user, "syllabus.view", resource)) throw new PermissionError();

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
  else if (syllabus?.status === "APPROVED")
    lockedReason = `This syllabus is approved (${syllabus.officialVersion?.label ?? "final"}). The BoS Coordinator can unlock it to make a correction.`;

  return { user, scheme, course, rows, assignments, syllabus, format, resource, lockedReason };
}

/** Where the syllabus stands in the review workflow (the input of `workflowBlocker`). */
export async function workflowState(syllabus, errorCount, tx = db) {
  if (!syllabus) {
    return {
      status: "DRAFT",
      stage: null,
      major: 0,
      minor: 0,
      label: null,
      hasUncommittedChanges: false,
      saved: false,
      errorCount,
      pendingCount: 0,
      inputCount: 0,
      versionsSinceApproval: 0,
    };
  }
  const [inputs, versionsSinceApproval] = await Promise.all([
    syllabus.stage && syllabus.status === "IN_REVIEW"
      ? tx.reviewInput.findMany({
          where: { syllabusId: syllabus.id, stage: syllabus.stage },
          select: { actionTaken: true, decision: true },
        })
      : [],
    syllabus.status === "REVISING" && syllabus.officialVersionId
      ? tx.syllabusVersion.count({
          where: { syllabusId: syllabus.id, createdAt: { gt: (await officialCreatedAt(syllabus, tx)) ?? new Date(0) } },
        })
      : 0,
  ]);
  return {
    status: syllabus.status,
    stage: syllabus.stage,
    major: syllabus.majorVersion,
    minor: syllabus.minorVersion,
    label: syllabus.majorVersion > 0 ? versionLabel(syllabus.majorVersion, syllabus.minorVersion) : null,
    hasUncommittedChanges: syllabus.committedRevision !== null && syllabus.revision !== syllabus.committedRevision,
    saved: true,
    errorCount,
    pendingCount: pendingInputs(inputs).length,
    inputCount: inputs.length,
    versionsSinceApproval,
  };
}

async function officialCreatedAt(syllabus, tx) {
  if (syllabus.officialVersion?.createdAt) return syllabus.officialVersion.createdAt;
  const v = await tx.syllabusVersion.findUnique({ where: { id: syllabus.officialVersionId } });
  return v?.createdAt ?? null;
}

/** Open flags of a syllabus with what changed, newest first (for the editor and review pages). */
export async function openRevisionFlags(syllabusId) {
  if (!syllabusId) return [];
  const flags = await db.syllabusRevisionFlag.findMany({
    where: { syllabusId, resolvedAt: null },
    orderBy: { createdAt: "desc" },
    include: { amendment: { include: { createdBy: { select: { name: true } } } } },
  });
  return flags.map((f) => ({
    id: f.id,
    summary: f.amendment.summary,
    at: f.amendment.createdAt,
    by: f.amendment.createdBy?.name ?? null,
    errorCount: f.errorCount,
    warningCount: f.warningCount,
  }));
}

/** The workflow actions with the reason each one is blocked (null = allowed). */
export function workflowBlockers(state) {
  return Object.fromEntries(
    ["submit", "commit", "close", "unlock", "approve"].map((a) => [a, workflowBlocker(a, state)]),
  );
}

/**
 * Everything the editor, the preview and the PDF need (GET /api/syllabi/:schemeId/:courseId).
 * Also returns the loaded context (`ctx`) for routes that go on to change the syllabus.
 */
export async function loadEditorData(req) {
  return buildEditorData(await loadContext(req));
}

/** loadEditorData for an already loaded context. */
export async function buildEditorData(ctx) {
  const { user, scheme, course, rows, assignments, syllabus, format, resource, lockedReason } = ctx;
  const canEdit = !lockedReason && can(user, "syllabus.edit", resource);
  const [institution, outcomes, bloomLevels, textBlocks, revisionFlags, carrySources] = await Promise.all([
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
    openRevisionFlags(syllabus?.id),
    // A syllabus not started yet can begin from an earlier scheme's syllabus (Phase 4).
    !syllabus && canEdit ? carryForwardSources(scheme, course) : [],
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
    canEdit,
    // Reviewing continues while the working copy is locked (approved), so it has its own flag.
    canReview: scheme.status === "PUBLISHED" && !!syllabus && can(user, "syllabus.review", resource),
    lockedReason,
    // Scheme amendments since the last version that may need a change here (README §5).
    revisionFlags,
    carryForward: { sources: carrySources },
    syllabus: {
      id: syllabus?.id ?? null,
      status: syllabus?.status ?? "DRAFT",
      revision: syllabus?.revision ?? 0, // 0 = not started; the first save creates it
      updatedAt: syllabus?.updatedAt ?? null,
      updatedBy: syllabus?.updatedBy?.name ?? null,
      officialVersion: syllabus?.officialVersion
        ? { id: syllabus.officialVersion.id, label: syllabus.officialVersion.label }
        : null,
      carriedFrom: syllabus?.carriedFrom
        ? {
            label: syllabus.carriedFrom.label,
            schemeName: syllabus.carriedFrom.syllabus.scheme.name,
            courseCode: syllabus.carriedFrom.syllabus.course.code,
          }
        : null,
      content: format
        ? syllabus
          ? normalizeSyllabusContent(syllabus.content, format)
          : emptySyllabusContent(format)
        : null,
    },
  };
  // The same rules the editor runs live (README §9); submitting and saving a version refuse errors.
  data.validation = format ? validateSyllabus(data.syllabus.content, validationContext(data)) : [];
  data.workflow = await workflowState(syllabus, summarizeIssues(data.validation).errors);
  return { ctx, data };
}
