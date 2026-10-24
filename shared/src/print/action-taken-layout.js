// Action Taken report print layout (README §7): one syllabus, one stage → one HTML document.
// Visual reference: "Action Taken Format.docx" (four stage headings; S.No, Input, Inputs given by,
// Action Taken). Used for the on-screen preview and, through the API, for the PDF.
//
// Pure function: every value is escaped here.
import { actionTakenHeadings, decisionLabels, sectionRefLabel } from "../domain/reviews/workflow.js";
import { reviewerCategoryLabels } from "../labels.js";
import { escapeHtml as esc } from "./rich-text.js";
import { baseCss, cssString, fontFaces } from "./syllabus-layout.js";

const when = (value, withTime = true) =>
  new Date(value).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    year: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  });

const multiline = (text) => esc(text ?? "").replace(/\r?\n/g, "<br>");

/**
 * @param {object} doc
 * @param {{ name: string, shortName?: string, address?: string }} doc.institution
 * @param {{ code: string, title: string }} doc.course
 * @param {{ name: string }} doc.scheme
 * @param {number[]} doc.semesters
 * @param {string} doc.stage                        INTERNAL_BOS | EXPERT | EXTERNAL_BOS | ACADEMIC_COUNCIL
 * @param {{ heldAt: string, venue: string, title?: string }[]} doc.meetings  meetings that gave inputs
 * @param {object[]} doc.inputs   { sectionRef, inputText, givenBy?, actionTaken, decision, reviewedLabel, resultingLabel }
 * @param {object[]} [doc.unlocks]  { reason, fromLabel, createdAt, by } — shown as extra rows (rule 5)
 * @param {(file: string) => string} [doc.fontUrl]
 * @param {Date} [doc.generatedAt]
 * @returns {string} a complete HTML document
 */
export function renderActionTakenHtml(doc) {
  const { course, stage } = doc;
  const fontUrl = doc.fontUrl ?? ((file) => `fonts/${file}`);
  const heading = actionTakenHeadings[stage];
  const footerLeft = `${doc.institution.shortName || doc.institution.name} · Printed ${when(doc.generatedAt ?? new Date())}`;

  const meetings = doc.meetings.length
    ? doc.meetings.map((m) => `${when(m.heldAt)}${m.venue ? `, ${m.venue}` : ""}${m.title ? ` (${m.title})` : ""}`)
    : ["—"];

  let n = 0;
  const rows = [
    ...doc.inputs.map((i) => {
      const by = i.givenBy;
      const givenBy = by
        ? [
            `<strong>${esc(by.name)}</strong>`,
            esc(reviewerCategoryLabels[by.category] ?? by.category),
            [by.designation, by.organisation].filter(Boolean).map(esc).join(", "),
          ]
            .filter(Boolean)
            .join("<br>")
        : "—";
      const decision = i.decision
        ? `<div class="decision">${esc(decisionLabels[i.decision])}${i.resultingLabel ? ` · incorporated in ${esc(i.resultingLabel)}` : ""}</div>`
        : "";
      return `<tr><td class="num">${++n}.</td>
<td><div class="ref">${esc(sectionRefLabel(i.sectionRef))} · on ${esc(i.reviewedLabel)}</div>${multiline(i.inputText)}</td>
<td>${givenBy}</td>
<td>${i.actionTaken ? multiline(i.actionTaken) : `<span class="pending">Pending</span>`}${decision}</td></tr>`;
    }),
    ...(doc.unlocks ?? []).map(
      (u) => `<tr class="unlock"><td class="num">${++n}.</td>
<td><div class="ref">Unlocked after ${esc(u.fromLabel)} on ${esc(when(u.createdAt, false))}</div>${multiline(u.reason)}</td>
<td>${esc(u.by ?? "BoS Coordinator")}<br>BoS Coordinator</td>
<td>Correction made as a new minor version; the approved version stayed in force until re-approval.</td></tr>`,
    ),
  ];

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>${esc(`${course.code} – Action Taken – ${heading}`)}</title>
<style>
${fontFaces(fontUrl)}
@page {
  size: A4;
  margin: 18mm 18mm 18mm 18mm;
  @top-left { content: ${cssString(`${course.code} · ${doc.scheme.name}`)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @top-right { content: ${cssString(`Action Taken – ${heading}`)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @bottom-left { content: ${cssString(footerLeft)}; font: 8pt Carlito, Calibri, sans-serif; color: #555; }
  @bottom-right { content: "Page " counter(page) " of " counter(pages); font: 8pt Carlito, Calibri, sans-serif; color: #555; }
}
${baseCss}
.institution { text-align: center; margin-bottom: 6pt; }
.institution .name { font-weight: 700; font-size: 13pt; }
.institution .logo { height: 15mm; width: auto; margin-bottom: 3pt; }
.institution .address { font-size: 9.5pt; }
.report-title { text-align: center; font-weight: 700; font-size: 12pt; margin: 6pt 0 8pt; }
.ref { font-size: 8.5pt; color: #444; margin-bottom: 2pt; }
.decision { font-size: 8.5pt; margin-top: 3pt; font-style: italic; }
.pending { color: #b45309; font-style: italic; }
.unlock td { background: #f7f7f7; }
</style>
</head>
<body>
<div class="sheet">
<div class="institution">
  ${doc.institution.logoUrl ? `<img class="logo" src="${esc(doc.institution.logoUrl)}" alt="">` : ""}
  <div class="name">${esc(doc.institution.name)}</div>
  ${doc.institution.address ? `<div class="address">${esc(doc.institution.address)}</div>` : ""}
</div>
<div class="report-title">Action Taken Report – ${esc(heading)}</div>
<table class="grid header">
<colgroup><col style="width:24%"><col style="width:26%"><col style="width:18%"><col style="width:32%"></colgroup>
<tr><th>Course</th><td colspan="3">${esc(course.code)} – ${esc(course.title)}</td></tr>
<tr><th>Semester</th><td>${esc(doc.semesters.join(", "))}</td><th>Scheme</th><td>${esc(doc.scheme.name)}</td></tr>
<tr><th>Meeting date, time and venue</th><td colspan="3">${meetings.map(esc).join("<br>")}</td></tr>
</table>
<table class="grid">
<colgroup><col style="width:7%"><col style="width:36%"><col style="width:22%"><col style="width:35%"></colgroup>
<thead><tr><th class="center">S.No</th><th>Input</th><th>Inputs given by<br><span class="small">Name, category, designation and organisation</span></th><th>Action Taken</th></tr></thead>
<tbody>
${rows.length ? rows.join("\n") : `<tr><td colspan="4" class="center">No inputs were recorded at this stage.</td></tr>`}
</tbody>
</table>
<div class="signatures">
  <div><div class="sign-line"></div>Course Coordinator</div>
  <div><div class="sign-line"></div>BoS Coordinator</div>
  <div><div class="sign-line"></div>Chairperson, BOS</div>
</div>
</div>
</body>
</html>`;
}
