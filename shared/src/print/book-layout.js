// Compiled syllabus book (README §8, Phase 4): the front matter — cover, scheme of teaching and examination,
// and a table of contents. The server renders it to PDF and appends each course's approved, frozen syllabus
// PDF unchanged. Contents rows link to `${bookLinkPrefix}<n>`; the server turns those links into jumps to
// the right page of the book (Chromium only makes links within one document).
//
// Pure function, no DOM: every value is escaped here.
import { escapeHtml as esc } from "./rich-text.js";
import { baseCss, cssString, fontFaces } from "./syllabus-layout.js";

export const BOOK_LAYOUT_VERSION = 1;

/** Placeholder link of contents entry n; replaced by an in-document link when the book is assembled. */
export const bookLinkPrefix = "https://book.invalid/contents/";

/**
 * @param {object} doc
 * @param {{ name: string, shortName?: string, address?: string }} doc.institution
 * @param {{ name: string, framework?: string, effectiveFrom?: string }} doc.scheme
 * @param {{ code: string, name: string, department: string }} doc.programme
 * @param {{ semester: number, courses: BookCourse[] }[]} doc.semesters
 *   BookCourse = { code, title, category, credits: "L:T:P", lHours, tHours, pHours, twSlHours, cieMarks, seeMarks,
 *                  group?: string (elective basket), entry: number|null (contents number), page: number|null,
 *                  note?: string (why it is not in the book) }
 * @param {(file: string) => string} [doc.fontUrl]
 * @param {Date} [doc.generatedAt]
 * @returns {string} a complete HTML document
 */
export function renderBookFrontMatter(doc) {
  const fontUrl = doc.fontUrl ?? ((file) => `fonts/${file}`);
  const generated = (doc.generatedAt ?? new Date()).toLocaleDateString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
  const semesterText =
    doc.semesters.length === 1
      ? `Semester ${doc.semesters[0].semester}`
      : `Semesters ${doc.semesters.map((s) => s.semester).join(", ")}`;
  const running = `${doc.programme.code} · ${doc.scheme.name} · Syllabus book`;
  const footerLeft = `${doc.institution.shortName || doc.institution.name} · Compiled ${generated}`;

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(`${doc.programme.code} ${doc.scheme.name} – Syllabus book`)}</title>
<style>
${fontFaces(fontUrl)}
@page {
  size: A4;
  margin: 18mm 18mm 18mm 18mm;
  @top-left { content: ${cssString(running)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @bottom-left { content: ${cssString(footerLeft)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @bottom-right { content: "Page " counter(page); font: 8pt Carlito, Calibri, sans-serif; color: #555; }
}
@page :first {
  @top-left { content: none; }
  @bottom-left { content: none; }
  @bottom-right { content: none; }
}
${baseCss}
.cover { height: 250mm; display: flex; flex-direction: column; justify-content: center; text-align: center; break-after: page; }
.cover .name { font-size: 20pt; font-weight: 700; }
.cover .address { font-size: 11pt; margin-top: 4pt; }
.cover .book { font-size: 26pt; font-weight: 700; margin-top: 60pt; letter-spacing: 1pt; }
.cover .programme { font-size: 15pt; margin-top: 14pt; }
.cover .scheme { font-size: 13pt; margin-top: 30pt; }
.cover .framework { font-size: 11pt; margin-top: 4pt; font-style: italic; }
.cover .compiled { font-size: 10pt; margin-top: 60pt; color: #444; }
h1 { font-size: 14pt; text-align: center; margin: 0 0 10pt; }
.scheme-table th, .scheme-table td { font-size: 9pt; padding: 2pt 3pt; }
.scheme-table th { background: #f2f2f2; text-align: center; }
.scheme-table .group td { font-style: italic; background: #fafafa; }
.section { break-before: page; }
.contents { width: 100%; border-collapse: collapse; }
.contents td { padding: 3pt 0; vertical-align: bottom; font-size: 10.5pt; }
.contents .sem td { font-weight: 700; padding-top: 10pt; }
.contents a { color: #000; text-decoration: none; }
.contents .entry { display: flex; align-items: baseline; gap: 4pt; }
.contents .dots { flex: 1; border-bottom: 1pt dotted #777; transform: translateY(-3pt); }
.contents .page { width: 14mm; text-align: right; }
.contents .missing { color: #666; font-style: italic; }
</style>
</head>
<body>
<div class="sheet">
<div class="cover">
  <div class="name">${esc(doc.institution.name)}</div>
  ${doc.institution.address ? `<div class="address">${esc(doc.institution.address)}</div>` : ""}
  <div class="book">SYLLABUS BOOK</div>
  <div class="programme">${esc(doc.programme.name)}</div>
  <div class="programme">${esc(semesterText)}</div>
  <div class="scheme">${esc(doc.scheme.name)}${doc.scheme.effectiveFrom ? ` · Effective from ${esc(doc.scheme.effectiveFrom)}` : ""}</div>
  ${doc.scheme.framework ? `<div class="framework">${esc(doc.scheme.framework)}</div>` : ""}
  <div class="compiled">Approved syllabi compiled on ${esc(generated)}</div>
</div>

<h1>Scheme of Teaching and Examination</h1>
${doc.semesters.map(schemeTable).join("\n")}

<div class="section">
<h1>Contents</h1>
<table class="contents">
${doc.semesters.map(contentsRows).join("\n")}
</table>
</div>
</div>
</body>
</html>`;
}

function schemeTable({ semester, courses }) {
  let n = 0;
  let group = null;
  const rows = [];
  for (const c of courses) {
    if (c.group && c.group !== group) rows.push(`<tr class="group"><td colspan="11">${esc(c.group)}</td></tr>`);
    group = c.group ?? null;
    rows.push(`<tr><td class="center">${++n}</td><td>${esc(c.code)}</td><td>${esc(c.title)}</td><td class="center">${esc(c.category)}</td>
<td class="center">${esc(c.credits)}</td><td class="center">${c.lHours}</td><td class="center">${c.tHours}</td><td class="center">${c.pHours}</td>
<td class="center">${c.twSlHours}</td><td class="center">${c.cieMarks}</td><td class="center">${c.seeMarks ?? "—"}</td></tr>`);
  }
  return `<h2>Semester ${semester}</h2>
<table class="grid scheme-table">
<colgroup><col style="width:5%"><col style="width:12%"><col><col style="width:8%"><col style="width:8%"><col style="width:5%"><col style="width:5%"><col style="width:5%"><col style="width:7%"><col style="width:6%"><col style="width:6%"></colgroup>
<thead><tr><th>Sl.</th><th>Code</th><th>Course</th><th>Category</th><th>Credits L:T:P</th><th>L</th><th>T</th><th>P</th><th>TW&amp;SL</th><th>CIE</th><th>SEE</th></tr></thead>
<tbody>${rows.join("\n")}</tbody>
</table>`;
}

function contentsRows({ semester, courses }) {
  const rows = courses.map((c) => {
    const label = `${esc(c.code)} – ${esc(c.title)}`;
    if (c.entry == null) {
      return `<tr><td><div class="entry"><span>${label}</span><span class="dots"></span><span class="missing">${esc(c.note ?? "Not included")}</span></div></td></tr>`;
    }
    return `<tr><td><a href="${bookLinkPrefix}${c.entry}"><div class="entry"><span>${label}</span><span class="dots"></span><span class="page">${c.page ?? ""}</span></div></a></td></tr>`;
  });
  return `<tr class="sem"><td>Semester ${semester}</td></tr>\n${rows.join("\n")}`;
}
