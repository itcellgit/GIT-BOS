// Syllabus print layout (README §8): syllabus JSON → one self-contained HTML document, for every format.
// The same HTML is used for the on-screen preview (browser) and the PDF (server, headless Chromium),
// so what faculty see is what prints. Visual references: the 2025 Theory, Integrated, project-based and Lab/AEC
// templates (README §1); the format decides which sections print (Appendix B).
//
// Pure function, no DOM: every value is escaped here, so faculty text can never inject markup.
// Changing the structure of this layout? Bump LAYOUT_VERSION (stored with frozen PDFs from Phase 3).
import { romanNumeral, syllabusTotals } from "../domain/syllabi/content.js";
import { resolveSections, sectionEnabled } from "../domain/syllabi/sections.js";
import { escapeHtml as esc, inline, renderRichText } from "./rich-text.js";

export const LAYOUT_VERSION = 5; // 2: experiments · 3: institution header with logo · 4: section order/labels set per format · 5: verification QR

/** Font files the layout loads, through `doc.fontUrl`. The server embeds them in PDF jobs. */
export const printFontFiles = [
  "carlito-latin-400-normal.woff2",
  "carlito-latin-700-normal.woff2",
  "carlito-latin-400-italic.woff2",
  "carlito-latin-700-italic.woff2",
];

/**
 * @param {object} doc
 * @param {{ name: string, shortName?: string, address?: string }} doc.institution
 * @param {{ name: string, teachingWeeks: number, hoursPerCredit: number }} doc.scheme
 * @param {{ code: string, title: string }} doc.course
 * @param {object[]} doc.offerings    scheme course rows (programme, semester, category, credits, hours, marks)
 * @param {object} doc.format         FormatConfig (title, prerequisiteLabel, hasReferenceBooks)
 * @param {object} doc.content        normalised content (see domain/syllabi/content.js)
 * @param {{ pos: object[], psos: { programmeCode: string, items: object[] }[] }} doc.lists
 * @param {object[]} doc.bloomLevels
 * @param {object[]} doc.textBlocks   standard text for the format
 * @param {string[]} [doc.authors]    names of the faculty who framed the syllabus
 * @param {{ label: string, draft: boolean }} doc.status   e.g. { label: "Draft – working copy", draft: true }
 * @param {{ url: string, qrUrl: string }} [doc.verification]  approved PDFs: where to check it is genuine (QR image)
 * @param {(file: string) => string} [doc.fontUrl]  URL of each Carlito file (a path or a data: URL)
 * @param {Date} [doc.generatedAt]
 * @returns {string} a complete HTML document
 */
export function renderSyllabusLayout(doc) {
  const { course, status } = doc;
  const fontUrl = doc.fontUrl ?? ((file) => `fonts/${file}`);
  const generated = (doc.generatedAt ?? new Date()).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", // the server (VPS) runs in UTC
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
  const runningLeft = `${course.code} · ${doc.scheme.name}`;
  const runningRight = status.label;
  const footerLeft = `${doc.institution.shortName || doc.institution.name} · Printed ${generated}`;

  const body = [
    institutionHeader(doc),
    titleTable(doc),
    headerTable(doc),
    // The sections between the course details and the signatures, in the order Dean Academics set for the
    // format, without the ones turned off, under their headings (domain/syllabi/sections.js).
    ...resolveSections(doc.format)
      .filter((s) => s.enabled)
      .map((s) => sectionRenderers[s.id](doc, s.label)),
    signatureBlock(doc),
    verificationBlock(doc),
  ].join("\n");

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(`${course.code} ${course.title} – Syllabus`)}</title>
<style>
${fontFaces(fontUrl)}
@page {
  size: A4;
  margin: 18mm 20mm 18mm 20mm;
  @top-left { content: ${cssString(runningLeft)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @top-right { content: ${cssString(runningRight)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @bottom-left { content: ${cssString(footerLeft)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Carlito, Calibri, sans-serif; color: #555; }
}
${baseCss}
</style>
</head>
<body>
${status.draft ? `<div class="watermark" aria-hidden="true">DRAFT</div>` : ""}
<div class="sheet">
${status.draft ? `<p class="screen-only draft-note">${esc(status.label)} — not an approved syllabus.</p>` : ""}
${body}
</div>
</body>
</html>`;
}

// --- Sections ----------------------------------------------------------------------------------------

/** The institution's name, address and logo (README §5 "Branding"); edited by the Administrator. */
function institutionHeader({ institution }) {
  if (!institution?.name) return "";
  const logo = institution.logoUrl ? `<img class="logo" src="${esc(institution.logoUrl)}" alt="">` : "";
  return `<div class="institution-header">${logo}<div>
  <div class="institution-name">${esc(institution.name)}</div>
  ${institution.address ? `<div class="institution-address">${esc(institution.address)}</div>` : ""}
</div></div>`;
}

/** How each configurable section prints; `heading` is its label (null for sections whose heading comes from elsewhere). */
const sectionRenderers = {
  objectives: (doc, heading) => objectivesTable(doc.content, heading),
  prerequisites: (doc) => prerequisitesTable(doc),
  units: (doc) => doc.content.units.map(unitTable).join("\n"),
  flipped: (doc, heading) => (doc.content.units.length ? flippedTable(doc.content, heading) : ""),
  experiments: (doc) => experimentsTable(doc),
  books: (doc, heading) => booksTable(doc, heading),
  methods: (doc) => methodsTable(doc),
  activities: (doc) => learningActivities(doc),
  twsl: (doc, heading) => twSlTable(doc.content, heading),
  outcomes: (doc, heading) => outcomesTable(doc, heading),
  standard: (doc) => standardBlocks(doc),
  mapping: (doc, heading) => mappingTable(doc, heading),
};

function titleTable({ format, course }) {
  return `<table class="title"><tr><td>
  <div class="template-name">${esc(format.title)}</div>
  <div class="course-title">${esc(course.title.toUpperCase())}</div>
</td></tr></table>`;
}

function headerTable({ offerings, scheme, content, course, format }) {
  const o = offerings[0];
  const totals = syllabusTotals(content);
  const credits = o.lCredits + o.tCredits + o.pCredits;
  const perWeek = (h) => {
    const v = h / scheme.teachingWeeks;
    return Number.isInteger(v) ? String(v) : v.toFixed(1);
  };
  const offered =
    offerings.length > 1
      ? `<p class="note">Offered in ${esc(offerings.map((x) => `${x.programme.name} (semester ${x.semester})`).join("; "))}. One syllabus serves all of them.</p>`
      : "";
  return `<table class="grid header">
<colgroup><col style="width:21%"><col style="width:15%"><col style="width:14%"><col style="width:16%"><col style="width:20%"><col style="width:14%"></colgroup>
<tr><th>Course Code</th><td>${esc(course.code)}</td><th>Course type</th><td>${esc(o.category.code)}</td><th>Credits L:T:P</th><td>${o.lCredits}:${o.tCredits}:${o.pCredits}</td></tr>
<tr><th>Hours/week: L:T:P</th><td colspan="3">${perWeek(o.lHours)}:${perWeek(o.tHours)}:${perWeek(o.pHours)}</td><th>Total credits</th><td>${credits}</td></tr>
<tr><th>Total Hours of Pedagogy L:T:P:SL:TW</th><td colspan="3">${o.lHours}:${o.tHours}:${o.pHours}:${totals.slHours}:${totals.twHours} &nbsp; Total = ${credits * scheme.hoursPerCredit} Hrs</td><th>CIE Marks</th><td>${o.cieMarks}</td></tr>
${content.units.length && sectionEnabled(format, "flipped") ? `<tr><th>Flipped Classes content</th><td colspan="3">${totals.flippedSessions} Hours</td>` : `<tr><td colspan="4"></td>`}<th>SEE Marks</th><td>${o.seeMarks ?? "—"}</td></tr>
</table>${offered}`;
}

function numberedRows(items) {
  return items.map((text, i) => `<tr><td class="num">${i + 1}.</td><td>${multiline(text)}</td></tr>`).join("");
}

function objectivesTable(content, heading) {
  const items = content.objectives.filter((t) => t.trim());
  return `<table class="grid">
<colgroup><col class="num-col"><col></colgroup>
<thead><tr><th colspan="2" class="band">${esc(heading)}</th></tr></thead>
<tbody>${numberedRows(items.length ? items : [""])}</tbody>
</table>`;
}

function prerequisitesTable({ format, content }) {
  return `<table class="grid"><tr><td><strong>${esc(format.prerequisiteLabel)} :</strong> ${multiline(content.prerequisites)}</td></tr></table>`;
}

function unitTable(unit, i) {
  const title = unit.title.trim() ? `: ${esc(unit.title.trim())}` : "";
  return `<table class="grid unit">
<colgroup><col style="width:68%"><col></colgroup>
<tr><th class="left">Unit – ${romanNumeral(i + 1)}${title}</th><th class="right">Contact Hours = ${unit.hours ?? ""} Hours</th></tr>
<tr><td colspan="2" class="unit-content">${multiline(unit.content)}</td></tr>
</table>`;
}

function flippedTable(content, heading) {
  const heads = content.flippedSessions.map((_, i) => `<th>${romanNumeral(i + 1)}</th>`).join("");
  const cells = content.flippedSessions.map((n) => `<td class="center">${n ?? ""}</td>`).join("");
  return `<h2>${esc(heading)}</h2>
<table class="grid keep">
<tr><th class="left">Unit No.</th>${heads}</tr>
<tr><th class="left">No. for Flipped Classroom Sessions</th>${cells}</tr>
</table>`;
}

/** Practical component (Integrated) or list of experiments (Lab/AEC), then the open-ended ones. */
function experimentsTable({ format, content }) {
  const experiments = content.experiments ?? [];
  const openEnded = content.openEnded ?? [];
  if (experiments.length + openEnded.length === 0) return "";
  const rows = (items) =>
    items
      .map(
        (e, i) =>
          `<tr><td class="num">${i + 1}.</td><td>${multiline(e.title)}</td><td class="center">${e.hours ?? ""}</td></tr>`,
      )
      .join("");
  const band = format.unitCount > 0 ? "Practical Component" : "List of Experiments";
  return `<table class="grid">
<colgroup><col class="num-col"><col><col style="width:12%"></colgroup>
<thead><tr><th colspan="3" class="band">${band}</th></tr>
<tr><th class="center">Sl. No.</th><th>Experiments</th><th class="center">Hours</th></tr></thead>
<tbody>
${rows(experiments)}
${openEnded.length ? `<tr><td></td><td colspan="2"><strong>Open-ended experiments</strong></td></tr>${rows(openEnded)}` : ""}
</tbody>
</table>`;
}

const bookRow = (b) =>
  [b.authors, b.title, b.publisher, b.edition, b.year]
    .map((v) => v.trim())
    .filter(Boolean)
    .join(", ");

function booksTable({ format, content }, heading) {
  const group = (label, rows) => {
    const items = rows.filter((r) => r);
    return `<tr><td></td><td><strong>${label}</strong></td></tr>${numberedRows(items.length ? items : [""])}`;
  };
  const eres = content.eResources.map((r) => [r.title.trim(), r.url.trim()].filter(Boolean).join(" – "));
  return `<table class="grid">
<colgroup><col class="num-col"><col></colgroup>
<thead><tr><th colspan="2" class="band">${esc(heading)}</th></tr></thead>
<tbody>
${group("Text Books:", content.textBooks.map(bookRow))}
${format.hasReferenceBooks ? group("Reference Books:", content.referenceBooks.map(bookRow)) : ""}
${group("E-resources (NPTEL/SWAYAM.. Any Other) - mention links", eres)}
</tbody>
</table>`;
}

/** Text blocks of a kind that apply to this course (format and year of study). */
function blocksOf(doc, kind) {
  const year = Math.ceil(doc.offerings[0].semester / 2);
  return doc.textBlocks.filter((b) => b.kind === kind && (b.yearOfStudy == null || b.yearOfStudy === year));
}

const linesOf = (body) =>
  String(body ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

function methodsTable(doc) {
  const [delivery] = blocksOf(doc, "DELIVERY_METHODS");
  const [assessment] = blocksOf(doc, "ASSESSMENT_METHODS");
  if (!delivery && !assessment) return "";
  const left = linesOf(delivery?.body);
  const right = linesOf(assessment?.body);
  const rows = Array.from({ length: Math.max(left.length, right.length) }, (_, i) => {
    const cell = (list) =>
      list[i] ? `<td class="num">${i + 1}.</td><td>${inline(list[i])}</td>` : `<td class="num"></td><td></td>`;
    return `<tr>${cell(left)}${cell(right)}</tr>`;
  }).join("");
  return `<table class="grid keep">
<colgroup><col class="num-col"><col style="width:45%"><col class="num-col"><col></colgroup>
<thead><tr><th colspan="2" class="band">${esc(delivery?.title ?? "Course delivery methods")}</th><th colspan="2" class="band">${esc(assessment?.title ?? "Assessment methods")}</th></tr></thead>
<tbody>${rows}</tbody>
</table>`;
}

function learningActivities(doc) {
  return blocksOf(doc, "LEARNING_ACTIVITIES")
    .map(
      (b) => `<div class="keep"><h2>${esc(b.title.replace(/:?\s*$/, ""))}:</h2>
<ul>${linesOf(b.body)
        .map((l) => `<li>${inline(l)}</li>`)
        .join("")}</ul></div>`,
    )
    .join("\n");
}

function twSlTable({ termWork, selfLearning }, heading) {
  const part = (rows, label) => {
    const items = rows.filter((r) => r.activity.trim() || r.hours != null);
    const total = items.reduce((t, r) => t + (r.hours ?? 0), 0);
    const body = (items.length ? items : [{ activity: "", hours: null }])
      .map(
        (r, i) =>
          `<tr><td class="center">${i + 1}</td><td>${multiline(r.activity)}</td><td class="center">${r.hours ?? ""}</td></tr>`,
      )
      .join("");
    return `<tr><th class="center">Sl. No.</th><th>${label} Activity</th><th class="center">Number of Hours / Semester</th></tr>
${body}
<tr><td></td><td class="right"><strong>Total</strong></td><td class="center"><strong>${total}</strong></td></tr>`;
  };
  return `<table class="grid">
<colgroup><col style="width:10%"><col><col style="width:24%"></colgroup>
<thead><tr><th colspan="3" class="band">${esc(heading)}</th></tr></thead>
<tbody>
<tr><td colspan="3">Term work (includes assignments, projects, any other student activities etc.)</td></tr>
${part(termWork, "Term Work (TW)")}
<tr><td colspan="3">SL: Self Learning, MOOCs, spoken tutorials, online educational resources etc.</td></tr>
${part(selfLearning, "Self-Learning (SL)")}
</tbody>
</table>`;
}

/** The statement with the action verb in bold (the template asks to highlight it). */
function highlightVerb(statement, verb) {
  const stem = verb
    .trim()
    .toLowerCase()
    .replace(/[^a-z]/g, "")
    .replace(/e$|y$/, "");
  const match = stem ? new RegExp(`\\b${stem}[a-z]*\\b`, "i").exec(statement) : null;
  if (!match) return multiline(statement);
  const before = statement.slice(0, match.index);
  const after = statement.slice(match.index + match[0].length);
  return `${multiline(before)}<strong>${esc(match[0])}</strong>${multiline(after)}`;
}

function outcomesTable({ content, bloomLevels, lists }, heading) {
  const legend = bloomLevels.map((l) => `${esc(l.shortCode)} - ${esc(l.name)}`).join("; ");
  const multiProgramme = lists.psos.length > 1;
  const rows = content.outcomes
    .map((co, i) => {
      const level = bloomLevels.find((l) => l.level === co.level);
      const psos = lists.psos
        .map((g) => {
          const ticked = co.psos[g.programmeCode] ?? [];
          if (!ticked.length) return "";
          return multiProgramme ? `${g.programmeCode}: ${ticked.join(", ")}` : ticked.join(", ");
        })
        .filter(Boolean)
        .join("; ");
      return `<tr><td class="num">${i + 1}.</td><td>${highlightVerb(co.statement, co.verb)}</td><td class="center">${esc(level?.shortCode ?? "")}</td><td class="center">${esc(co.pos.join(", "))}</td><td class="center">${esc(psos)}</td></tr>`;
    })
    .join("");
  return `<table class="grid">
<colgroup><col class="num-col"><col><col style="width:11%"><col style="width:14%"><col style="width:14%"></colgroup>
<thead>
<tr><th colspan="5" class="band">${esc(heading)}<div class="legend"><strong>Learning Levels:</strong> ${legend}</div></th></tr>
<tr><th colspan="2" class="left">At the end of the course, the student will be able to</th><th class="center">Learning Level</th><th class="center">PO(s)</th><th class="center">PSO(s)</th></tr>
</thead>
<tbody>${rows}</tbody>
</table>`;
}

function standardBlocks(doc) {
  return ["CIE_SCHEME", "SEE_SCHEME", "RUBRICS"]
    .flatMap((kind) => blocksOf(doc, kind))
    .map((b) => `<section class="standard"><h2>${esc(b.title)}</h2>${renderRichText(b.body)}</section>`)
    .join("\n");
}

function mappingTable({ content, lists }, heading) {
  const groups = lists.psos.filter((g) => g.items.length > 0);
  const multiProgramme = lists.psos.length > 1;
  const psoCount = groups.reduce((n, g) => n + g.items.length, 0);
  const tick = (on) => (on ? `<td class="center tick">✓</td>` : `<td></td>`);
  const psoHeads = groups
    .flatMap((g) =>
      g.items.map(
        (p) =>
          `<th class="center">${esc(p.code)}${multiProgramme ? `<div class="small">${esc(g.programmeCode)}</div>` : ""}</th>`,
      ),
    )
    .join("");
  const rows = content.outcomes
    .map((co, i) => {
      const pos = lists.pos.map((p) => tick(co.pos.includes(p.code))).join("");
      const psos = groups
        .flatMap((g) => g.items.map((p) => tick((co.psos[g.programmeCode] ?? []).includes(p.code))))
        .join("");
      return `<tr><th class="center">${i + 1}</th>${pos}${psos}<td class="center small">${esc(co.wks.join(", "))}</td><td class="center small">${esc(co.sdgs.join(", "))}</td></tr>`;
    })
    .join("");
  return `<table class="grid mapping keep">
<thead>
<tr><th colspan="${1 + lists.pos.length}" class="band">${esc(heading)}</th><th colspan="${psoCount + 2}" class="band">CO-PSO-WK-SDG Mapping (Planned)</th></tr>
<tr><th class="center">CO</th>${lists.pos.map((p) => `<th class="center">${esc(p.code)}</th>`).join("")}${psoHeads}<th class="center">WK</th><th class="center">SDG</th></tr>
</thead>
<tbody>${rows}</tbody>
</table>`;
}

function signatureBlock({ authors = [] }) {
  return `<div class="signatures">
<div><div class="sign-line"></div>Name &amp; Signature of Faculty members<br>involved in designing the syllabus${
    authors.length ? `<div class="names">${authors.map(esc).join("<br>")}</div>` : ""
  }</div>
<div><div class="sign-line"></div>Name &amp; Signature of Faculty members<br>verifying/approving the syllabus</div>
</div>`;
}

/** Approved PDFs: a QR code and link to the portal's verification page (README §8). */
function verificationBlock({ verification }) {
  if (!verification) return "";
  return `<div class="verification">
<img src="${esc(verification.qrUrl)}" alt="">
<div>Verify this document: scan the code or open<br><span class="url">${esc(verification.url)}</span><br>The page shows what the Academic Council approved and checks a copy of this PDF.</div>
</div>`;
}

// --- Helpers -------------------------------------------------------------------------------------------

/** Escaped text keeping the author's line breaks. */
function multiline(text) {
  return esc(text ?? "").replace(/\r?\n/g, "<br>");
}

/** A CSS string literal (for @page margin boxes). */
export function cssString(value) {
  return `"${String(value)
    .replace(/[\\"]/g, "\\$&")
    .replace(/[\r\n]+/g, " ")}"`;
}

export function fontFaces(fontUrl) {
  const face = (weight, style, file) =>
    `@font-face { font-family: Carlito; font-weight: ${weight}; font-style: ${style}; src: url("${fontUrl(file)}") format("woff2"); }`;
  return [
    face(400, "normal", printFontFiles[0]),
    face(700, "normal", printFontFiles[1]),
    face(400, "italic", printFontFiles[2]),
    face(700, "italic", printFontFiles[3]),
  ].join("\n");
}

export const baseCss = `
* { box-sizing: border-box; }
html { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
body { margin: 0; font-family: Carlito, Calibri, "Segoe UI", sans-serif; font-size: 11pt; line-height: 1.25; color: #000; }
h2 { font-size: 11pt; font-weight: 700; margin: 10pt 0 4pt; break-after: avoid; }
p { margin: 0 0 4pt; }
ul, ol { margin: 2pt 0 6pt; padding-left: 18pt; }
table { width: 100%; border-collapse: collapse; margin: 0 0 8pt; }
tr, td, th { break-inside: avoid; }
thead { display: table-header-group; }
.grid th, .grid td, .rt-table th, .rt-table td, .title td { border: 0.75pt solid #000; padding: 3pt 5pt; vertical-align: top; text-align: left; }
.grid th, .rt-table th { font-weight: 700; }
.band { text-align: left; background: #f2f2f2; }
.num-col { width: 7%; }
.num { text-align: right; white-space: nowrap; width: 7%; }
.center { text-align: center !important; }
.right { text-align: right !important; }
.left { text-align: left !important; }
.small { font-size: 8.5pt; font-weight: 400; }
.note { font-size: 9pt; margin-top: -4pt; }
.title td { text-align: center; padding: 6pt; }
.institution-header { display: flex; align-items: center; justify-content: center; gap: 10pt; margin-bottom: 6pt; text-align: center; }
.institution-header .logo { height: 16mm; width: auto; }
.institution-name { font-weight: 700; font-size: 13pt; }
.institution-address { font-size: 9.5pt; }
.template-name { font-weight: 700; }
.course-title { font-weight: 700; font-size: 14pt; margin-top: 2pt; }
.header th { background: #f2f2f2; }
.unit { break-inside: auto; }
.unit tr:first-child { break-after: avoid; }
.unit-content { min-height: 30pt; }
.keep { break-inside: avoid; }
.legend { font-weight: 400; font-size: 9.5pt; margin-top: 2pt; }
.mapping th, .mapping td { padding: 2pt 2pt; font-size: 9.5pt; }
.tick { font-family: "DejaVu Sans", "Segoe UI Symbol", sans-serif; font-weight: 700; }
.standard { margin-top: 4pt; }
.standard .rt-table { font-size: 9.5pt; }
.standard .rt-table th { background: #f2f2f2; }
.signatures { display: flex; justify-content: space-between; gap: 24pt; margin-top: 40pt; break-inside: avoid; font-size: 10.5pt; }
.signatures > div { flex: 1; }
.sign-line { border-top: 0.75pt solid #000; width: 75%; margin-bottom: 4pt; }
.names { margin-top: 4pt; font-size: 9.5pt; }
.verification { display: flex; align-items: center; gap: 8pt; margin-top: 18pt; break-inside: avoid; font-size: 8.5pt; color: #333; }
.verification img { width: 20mm; height: 20mm; }
.verification .url { font-family: monospace; word-break: break-all; }
.watermark { display: none; }
@media print {
  .screen-only { display: none; }
  .watermark { display: block; position: fixed; top: 45%; left: 0; right: 0; text-align: center; transform: rotate(-35deg);
    font-size: 110pt; font-weight: 700; letter-spacing: 12pt; color: rgba(0, 0, 0, 0.07); pointer-events: none; z-index: 10; }
}
@media screen {
  body { background: #e5e7eb; padding: 16px 0; }
  .sheet { width: 210mm; max-width: calc(100% - 16px); margin: 0 auto; padding: 18mm 20mm; background: #fff; box-shadow: 0 1px 4px rgba(0,0,0,.2); }
  .draft-note { background: #fef3c7; border: 1px solid #f59e0b; padding: 4pt 8pt; margin-bottom: 10pt; font-size: 10pt; }
}
`;
