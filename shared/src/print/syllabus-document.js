// Turns the syllabus editor data (GET /api/syllabi/:schemeId/:courseId) into a printable HTML document.
// The browser preview and the server's PDF both call this, so they always print the same thing.
import { renderTheoryHtml } from "./theory-layout.js";

/** URL of a print font file served by the API (absolute, so it also works inside an iframe). */
export const printFontUrl = (file) => `/api/print/fonts/${file}`;

/**
 * @param {object} data     editor data from the API
 * @param {object} content  the working copy to print (the editor may pass unsaved content)
 * @param {{ fontUrl?: (file: string) => string, generatedAt?: Date }} [options]
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
    // Phase 2 replaces this with the version label and stage, e.g. "V2.1 – Under Expert Review".
    status: { label: "Draft – working copy (not submitted)", draft: true },
    fontUrl: options.fontUrl ?? printFontUrl,
    generatedAt: options.generatedAt,
  });
}
