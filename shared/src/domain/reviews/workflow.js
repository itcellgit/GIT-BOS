// Versions and the BOS review workflow (README §7). Pure rules used by the API (authoritative) and by
// the React app (to show or hide buttons), so both always agree on what may happen next.
//
//   DRAFT ──submit──▶ V1.0  INTERNAL_BOS ──close──▶ V2.0  EXPERT ──close──▶ EXTERNAL_BOS ──close──▶ V3.0
//         ACADEMIC_COUNCIL ──close + approval──▶ V4.0 APPROVED ──unlock──▶ REVISING ──commit──▶ V4.1 ──approve──▶ APPROVED
//
// During a stage the working copy stays editable so inputs can be incorporated; each "save version"
// (commit) creates the next minor version (V1.1, V2.1…). Versions themselves never change.

/** Review stages in order. */
export const stages = ["INTERNAL_BOS", "EXPERT", "EXTERNAL_BOS", "ACADEMIC_COUNCIL"];

export const stageLabels = {
  INTERNAL_BOS: "Internal BOS",
  EXPERT: "Industry Experts & Alumni",
  EXTERNAL_BOS: "External BOS",
  ACADEMIC_COUNCIL: "Academic Council",
};

/** The four headings of "Action Taken Format.docx". */
export const actionTakenHeadings = {
  INTERNAL_BOS: "Post Internal BOS",
  EXPERT: "Post Industry Experts & Alumni",
  EXTERNAL_BOS: "Post External BOS",
  ACADEMIC_COUNCIL: "Post Academic Council",
};

export const syllabusStatusLabels = {
  DRAFT: "Draft",
  IN_REVIEW: "In review",
  APPROVED: "Approved",
  REVISING: "Revising",
};

export const decisionLabels = { ACCEPTED: "Accepted", PARTLY: "Partly accepted", NOT_ACCEPTED: "Not accepted" };

/** Closing a stage: the major version it creates (null = none) and the stage that follows. */
const closing = {
  INTERNAL_BOS: { major: 2, next: "EXPERT" },
  EXPERT: { major: null, next: "EXTERNAL_BOS" },
  EXTERNAL_BOS: { major: 3, next: "ACADEMIC_COUNCIL" },
  ACADEMIC_COUNCIL: { major: 4, next: null },
};

export const versionLabel = (major, minor) => `V${major}.${minor}`;

/**
 * The status line printed on a version, e.g. "V2.1 – Industry Experts & Alumni review".
 * @param {{ major: number, minor: number, stage: string|null }} version
 * @param {{ official?: boolean }} [options] official = the approved version currently in force
 */
export function versionStatusLabel(version, { official = false } = {}) {
  const label = versionLabel(version.major, version.minor);
  if (version.major >= 4) return `${label} – Final${official ? " (Approved)" : ""}`;
  return `${label} – ${stageLabels[version.stage] ?? "Submitted"} review`;
}

/** The status line printed on the working copy. */
export function workingCopyStatusLabel(state) {
  if (state.status === "DRAFT") return "Draft – working copy (not submitted)";
  const after = versionLabel(state.major, state.minor);
  return state.hasUncommittedChanges
    ? `Working copy – changes after ${after} (not saved as a version)`
    : `${after} – working copy`;
}

/**
 * The version an event creates, or null when it creates none.
 * @param {{ status: string, stage: string|null, major: number, minor: number, hasUncommittedChanges: boolean }} state
 * @param {"submit" | "commit" | "close" | "approve"} event
 */
export function nextVersion(state, event) {
  switch (event) {
    case "submit":
      return { major: 1, minor: 0 };
    case "commit":
      return { major: state.major, minor: state.minor + 1 };
    case "close": {
      const major = closing[state.stage]?.major;
      if (major) return { major, minor: 0 };
      return state.hasUncommittedChanges ? { major: state.major, minor: state.minor + 1 } : null;
    }
    case "approve":
      return state.hasUncommittedChanges ? { major: state.major, minor: state.minor + 1 } : null;
  }
  return null;
}

/** The stage after closing `stage` (null after the Academic Council: the syllabus is approved). */
export const stageAfter = (stage) => closing[stage]?.next ?? null;

/** Inputs that still need an action taken and a decision (README §7, rule 3). */
export function pendingInputs(inputs) {
  return inputs.filter((i) => !i.actionTaken?.trim() || !i.decision);
}

/** Whether the working copy can be edited in this status. */
export const isWorkingCopyOpen = (status) => status !== "APPROVED";

/**
 * Why `action` cannot happen now (a sentence for the user), or null when it can.
 * The API calls this before every workflow change; the app uses it to enable buttons.
 * @param {"submit" | "commit" | "close" | "unlock" | "approve"} action
 * @param {object} state  { status, stage, major, minor, hasUncommittedChanges, saved, errorCount, pendingCount,
 *                          versionsSinceApproval }
 */
export function workflowBlocker(action, state) {
  const errors =
    state.errorCount > 0
      ? `Fix the ${state.errorCount} ${state.errorCount === 1 ? "error" : "errors"} in the checks first.`
      : null;
  switch (action) {
    case "submit":
      if (state.status !== "DRAFT") return "This syllabus has already been submitted.";
      if (!state.saved) return "Nothing has been saved yet.";
      return errors;
    case "commit":
      if (state.status !== "IN_REVIEW" && state.status !== "REVISING")
        return state.status === "DRAFT" ? "Submit the syllabus first." : "Unlock the syllabus first.";
      if (!state.hasUncommittedChanges) return `There are no changes since ${versionLabel(state.major, state.minor)}.`;
      return errors;
    case "close":
      if (state.status !== "IN_REVIEW") return "The syllabus is not in a review stage.";
      if (state.pendingCount > 0)
        return `${state.pendingCount} ${state.pendingCount === 1 ? "input still needs" : "inputs still need"} an action taken and a decision.`;
      if (nextVersion(state, "close")) return errors;
      return null;
    case "unlock":
      if (state.status !== "APPROVED") return "Only an approved syllabus is locked; the working copy is already open.";
      return null;
    case "approve":
      if (state.status !== "REVISING") return "Only a syllabus being revised after approval needs a new approval.";
      if (!state.hasUncommittedChanges && state.versionsSinceApproval === 0)
        return "Nothing has changed since the approved version.";
      return state.hasUncommittedChanges ? errors : null;
  }
  return "Unknown action.";
}

/**
 * Sections a review input can refer to (README §6 `section_ref`), for the current content.
 * @returns {{ value: string, label: string }[]}
 */
export function sectionRefOptions(content) {
  const units = content?.units?.length ?? 5;
  const outcomes = content?.outcomes?.length ?? 0;
  return [
    { value: "general", label: "General" },
    { value: "header", label: "Course details" },
    { value: "objectives", label: "Course learning objectives" },
    { value: "prerequisites", label: "Pre-requisites" },
    ...Array.from({ length: units }, (_, i) => ({ value: `unit:${i + 1}`, label: `Unit ${i + 1}` })),
    ...(units > 0 ? [{ value: "flipped", label: "Flipped classroom" }] : []),
    ...(content === null || content?.experiments?.length || content?.openEnded?.length
      ? [{ value: "experiments", label: "Experiments" }]
      : []),
    { value: "books", label: "Books and e-resources" },
    { value: "twsl", label: "Term work and self-learning" },
    { value: "outcomes", label: "Course outcomes" },
    ...Array.from({ length: outcomes }, (_, i) => ({ value: `co:${i + 1}`, label: `CO${i + 1}` })),
    { value: "mapping", label: "CO–PO/PSO mapping" },
    { value: "standard", label: "Standard sections (CIE, SEE, rubrics)" },
  ];
}

/** Display label for a section reference, e.g. "unit:3" → "Unit 3". */
export function sectionRefLabel(ref) {
  const [kind, n] = String(ref).split(":");
  if (kind === "unit") return `Unit ${n}`;
  if (kind === "co") return `CO${n}`;
  return sectionRefOptions(null).find((o) => o.value === ref)?.label ?? ref;
}
