// Dashboards (Phase 4, README §12): where each syllabus stands, as one ordered step of the path
// Not started → Draft → the four review stages → Approved. Pure functions shared by the API and the app.
import { stageLabels } from "./workflow.js";

/** Progress steps in order. The order is the meaning (an ordinal scale), so the app colours it with one ramp. */
export const progressSteps = [
  "NOT_STARTED",
  "DRAFT",
  "INTERNAL_BOS",
  "EXPERT",
  "EXTERNAL_BOS",
  "ACADEMIC_COUNCIL",
  "REVISING",
  "APPROVED",
];

export const progressLabels = {
  NOT_STARTED: "Not started",
  DRAFT: "Draft",
  ...stageLabels,
  REVISING: "Revising (after approval)",
  APPROVED: "Approved",
};

/**
 * The progress step of a syllabus.
 * @param {{ status: string, stage: string|null } | null} syllabus  null = not started
 */
export function progressStep(syllabus) {
  if (!syllabus) return "NOT_STARTED";
  if (syllabus.status === "IN_REVIEW") return syllabus.stage ?? "INTERNAL_BOS";
  return syllabus.status; // DRAFT, REVISING, APPROVED
}

/**
 * Counts per progress step for each group (a department, programme or semester).
 * @param {object[]} rows      dashboard rows, each with `step`
 * @param {(row: object) => string[]} keysOf  the group(s) a row belongs to (a course can serve several programmes)
 * @returns {{ key: string, total: number, counts: Record<string, number> }[]} sorted by key
 */
export function progressByGroup(rows, keysOf) {
  const groups = new Map();
  for (const row of rows) {
    for (const key of keysOf(row)) {
      let g = groups.get(key);
      if (!g) {
        g = { key, total: 0, counts: Object.fromEntries(progressSteps.map((s) => [s, 0])) };
        groups.set(key, g);
      }
      g.total++;
      g.counts[row.step]++;
    }
  }
  return [...groups.values()].sort((a, b) => a.key.localeCompare(b.key, undefined, { numeric: true }));
}
