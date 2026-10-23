// Scheme amendments (README §5 "Scheme lifecycle"): a Layer-1 change made while a scheme is published is
// recorded as an amendment, and every syllabus the change can affect is flagged "Needs revision".
// Pure rules: which syllabi a change reaches, and the one-line summary shown to people.
import { formatLabels } from "./rules.js";

/** The scheme settings that are rules (a change to the name or framework text affects no syllabus). */
export const schemeRuleFields = ["teachingWeeks", "hoursPerCredit"];

/**
 * Which syllabi a Layer-1 change can affect.
 *   { kind: "all" }                          every syllabus of the scheme
 *   { kind: "category", categoryId }         syllabi of courses listed in that category
 *   { kind: "format", format }               syllabi in that format
 *   { kind: "none" }                         recorded, but no syllabus needs revision (e.g. printed text)
 * @param {string} action   the audit action, e.g. "category.update"
 * @param {object} change   { categoryId?, format?, kind? (outcome kind) }
 */
export function amendmentScope(action, change = {}) {
  const [entity] = action.split(".");
  switch (entity) {
    case "scheme":
    case "bloom":
      return { kind: "all" };
    case "outcome":
      // PO / WK / SDG lists are institution-wide; PSOs are Layer 2 and never come through here.
      return { kind: "all" };
    case "category":
      return action === "category.create" ? { kind: "none" } : { kind: "category", categoryId: change.categoryId };
    case "creditPattern":
      return { kind: "category", categoryId: change.categoryId };
    case "format":
      return { kind: "format", format: change.format };
    case "textBlock":
      return { kind: "none" };
  }
  return { kind: "none" };
}

/** Whether a scheme update changed a rule (and so is an amendment), given the old and new values. */
export function schemeRulesChanged(before, after) {
  return schemeRuleFields.some((f) => after[f] !== undefined && before[f] !== after[f]);
}

const verbs = { create: "added", update: "changed", delete: "removed" };

/**
 * One line describing the amendment, e.g. "Category PCC changed" or "Hours per credit 30 → 32".
 * @param {string} action
 * @param {object} change  { code?, title?, format?, kind?, before?, after? }
 */
export function amendmentSummary(action, change = {}) {
  const [entity, op] = action.split(".");
  const verb = verbs[op] ?? "changed";
  switch (entity) {
    case "scheme": {
      const parts = schemeRuleFields
        .filter((f) => change.before?.[f] !== change.after?.[f])
        .map(
          (f) =>
            `${f === "teachingWeeks" ? "Teaching weeks" : "Hours per credit"} ${change.before?.[f]} → ${change.after?.[f]}`,
        );
      return parts.length ? parts.join("; ") : "Scheme rules changed";
    }
    case "category":
      return `Category ${change.code ?? ""} ${verb}`.replace(/\s+/g, " ");
    case "creditPattern":
      return `Credit pattern ${change.pattern ?? ""} ${verb} in ${change.code ?? "a category"}`.replace(/\s+/g, " ");
    case "format":
      return `${formatLabels[change.format] ?? "Format"} format settings changed`;
    case "outcome":
      return `${change.kind ?? "Outcome"} ${change.code ?? ""} ${verb}`.replace(/\s+/g, " ");
    case "bloom":
      return `Bloom level ${change.code ?? ""} changed`.replace(/\s+/g, " ");
    case "textBlock":
      return `Standard text “${change.title ?? ""}” ${verb} (printed text only)`;
  }
  return "Scheme configuration changed";
}
