// Turns the syllabus editor data (GET /api/syllabi/:schemeId/:courseId) into a printable HTML document.
// The browser preview and the server's PDF both call this, so they always print the same thing.
import { workingCopyStatusLabel } from "../domain/reviews/workflow.js";
import { renderTheoryHtml } from "./theory-layout.js";

/** URL of a print font file served by the API (absolute, so it also works inside an iframe). */
export const printFontUrl = (file) => `/api/print/fonts/${file}`;

/**
 * @param {object} data     editor data from the API
 * @param {object} content  the content to print: the working copy, or a version's content
 * @param {{ fontUrl?: (file: string) => string, generatedAt?: Date,
 *           status?: { label: string, draft: boolean } }} [options]
 *   status: what the running header says. Defaults to the working copy's state (with a DRAFT
 *   watermark); a version passes its own label, e.g. "V2.1 – Industry Experts & Alumni review".
 */
export function syllabusHtml(data, content, options = {}) {
  return renderTheoryHtml({
    institution: data.institution,
    scheme: data.scheme,
    course: data.course,
    offerings: data.offerings,
    format: data.format,
    content,
    lists: data.lists,
    bloomLevels: data.bloomLevels,
    textBlocks: data.textBlocks,
    authors: data.assignments.map((a) => a.name),
    status: options.status ?? {
      label: data.workflow ? workingCopyStatusLabel(data.workflow) : "Draft – working copy (not submitted)",
      draft: true,
    },
    fontUrl: options.fontUrl ?? printFontUrl,
    generatedAt: options.generatedAt,
  });
}
