// Turns the review data (GET /api/syllabi/:schemeId/:courseId/review) into the Action Taken report
// for one stage. The browser preview and the server's PDF both call this.
import { renderActionTakenHtml } from "./action-taken-layout.js";
import { printFontUrl } from "./syllabus-document.js";

/**
 * @param {object} review  review data from the API
 * @param {string} stage   INTERNAL_BOS | EXPERT | EXTERNAL_BOS | ACADEMIC_COUNCIL
 * @param {{ fontUrl?: (file: string) => string, generatedAt?: Date }} [options]
 */
export function actionTakenHtml(review, stage, options = {}) {
  const inputs = review.inputs.filter((i) => i.stage === stage);
  // The meetings whose inputs are in the report, in date order.
  const meetings = [...new Map(inputs.filter((i) => i.meeting).map((i) => [i.meeting.id, i.meeting])).values()].sort(
    (a, b) => new Date(a.heldAt) - new Date(b.heldAt),
  );
  return renderActionTakenHtml({
    institution: review.institution,
    course: review.course,
    scheme: review.scheme,
    semesters: review.semesters,
    stage,
    meetings,
    inputs,
    unlocks: review.unlocks.filter((u) => u.stage === stage),
    fontUrl: options.fontUrl ?? printFontUrl,
    generatedAt: options.generatedAt,
  });
}
