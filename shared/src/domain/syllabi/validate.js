// Validation rules for a Theory syllabus (README §9). Pure functions, shared by the editor (live
// checks) and the API (before submission, Phase 2). Every number comes from the scheme and format
// configuration passed in `ctx`, never from constants.
//
// ctx = {
//   format:        FormatConfig (unitCount, cloMin/Max, coMin/Max, hasReferenceBooks)
//   offerings:     scheme-course rows for the course (lHours, tHours, pHours, twSlHours, credits, category)
//   hoursPerCredit scheme rule (e.g. 30)
//   bloomLevels:   { level, name, shortCode, verbs[] }[]
//   psoProgrammes: programme codes that have PSOs defined (a CO should map to one of each)
// }
//
// Each issue: { severity: "error" | "warning", section, message }. `section` is the editor's
// section id (header, objectives, units…). Errors block submission; warnings are shown for review.
import { romanNumeral, theoryTotals } from "./theory.js";

const filled = (s) => typeof s === "string" && s.trim() !== "";
const isBlankRow = (row, keys) => keys.every((k) => (typeof row[k] === "string" ? !filled(row[k]) : row[k] == null));

/** Validates a Theory working copy. Returns the list of issues (empty when everything passes). */
export function validateTheory(content, ctx) {
  const issues = [];
  const error = (section, message) => issues.push({ severity: "error", section, message });
  const warning = (section, message) => issues.push({ severity: "warning", section, message });
  const { format } = ctx;
  const offering = ctx.offerings[0];
  const totals = theoryTotals(content);

  // --- Header consistency (the scheme course row; fixed by the BoS Coordinator) ------------------
  for (const o of ctx.offerings) {
    if (o.category.passFail) continue;
    const credits = o.lCredits + o.tCredits + o.pCredits;
    const total = o.lHours + o.tHours + o.pHours + o.twSlHours;
    const expected = credits * ctx.hoursPerCredit;
    if (total !== expected) {
      error(
        "header",
        `${o.programme.code}: L + T + P + TW&SL in the scheme is ${total} hours but ${credits} credits need ${expected}. Ask the BoS Coordinator to correct the course list.`,
      );
    }
  }
  const differing = ctx.offerings.filter((o) => o.lHours !== offering.lHours || o.twSlHours !== offering.twSlHours);
  if (differing.length > 0) {
    error(
      "header",
      `The hours differ between programmes (${ctx.offerings.map((o) => o.programme.code).join(", ")}). One syllabus serves all of them, so the BoS Coordinator must make them equal.`,
    );
  }

  // --- Course learning objectives -------------------------------------------------------------------
  const objectives = content.objectives.filter(filled).length;
  if (objectives < format.cloMin || objectives > format.cloMax) {
    error("objectives", `Write ${format.cloMin}–${format.cloMax} course learning objectives (now ${objectives}).`);
  }

  // --- Prerequisites ----------------------------------------------------------------------------------
  if (!filled(content.prerequisites))
    error("prerequisites", "Fill in the pre-requisites (write “Nil” if there are none).");

  // --- Units ----------------------------------------------------------------------------------------------
  if (content.units.length !== format.unitCount) {
    error("units", `The format has exactly ${format.unitCount} units (now ${content.units.length}).`);
  }
  content.units.forEach((u, i) => {
    const name = `Unit ${romanNumeral(i + 1)}`;
    const missing = [
      !filled(u.title) && "title",
      !filled(u.content) && "content",
      u.hours == null && "contact hours",
    ].filter(Boolean);
    if (missing.length) error("units", `${name}: add the ${missing.join(", ")}.`);
    else if (u.hours === 0) error("units", `${name}: contact hours cannot be 0.`);
  });
  if (totals.unitHours !== offering.lHours) {
    error("units", `Unit hours add up to ${totals.unitHours}; the scheme has ${offering.lHours} lecture hours.`);
  }

  // --- Flipped classroom ------------------------------------------------------------------------------
  content.flippedSessions.forEach((n, i) => {
    const unitHours = content.units[i]?.hours;
    if (n != null && unitHours != null && n > unitHours) {
      error(
        "flipped",
        `Unit ${romanNumeral(i + 1)}: ${n} flipped sessions is more than its ${unitHours} contact hours.`,
      );
    }
  });
  if (totals.flippedSessions === 0) warning("flipped", "No flipped classroom sessions are planned.");

  // --- Books and e-resources ----------------------------------------------------------------------------
  const bookKeys = ["authors", "title", "publisher", "edition", "year"];
  const checkBooks = (books, label) => {
    let complete = 0;
    books.forEach((b, i) => {
      if (isBlankRow(b, bookKeys)) return;
      const missing = [
        !filled(b.authors) && "author(s)",
        !filled(b.title) && "title",
        !filled(b.publisher) && "publisher",
      ].filter(Boolean);
      if (missing.length) error("books", `${label} ${i + 1}: add the ${missing.join(", ")}.`);
      else complete += 1;
      if (!filled(b.edition) && !filled(b.year)) warning("books", `${label} ${i + 1}: give the edition or year.`);
    });
    return complete;
  };
  if (checkBooks(content.textBooks, "Text book") === 0) error("books", "Add at least one text book.");
  if (format.hasReferenceBooks) checkBooks(content.referenceBooks, "Reference book");
  content.eResources.forEach((r, i) => {
    if (isBlankRow(r, ["title", "url"])) return;
    if (!filled(r.title)) error("books", `E-resource ${i + 1}: add a title.`);
    if (!filled(r.url)) error("books", `E-resource ${i + 1}: add the link.`);
    else if (!isWebLink(r.url))
      error("books", `E-resource ${i + 1}: “${r.url.trim()}” is not a valid web link (https://…).`);
  });

  // --- Term work and self learning (Q2) -------------------------------------------------------------------
  const checkActivities = (rows, label) =>
    rows.forEach((a, i) => {
      if (isBlankRow(a, ["activity", "hours"])) return;
      if (!filled(a.activity)) error("twsl", `${label} row ${i + 1}: describe the activity.`);
      if (a.hours == null) error("twsl", `${label} row ${i + 1}: give the hours.`);
    });
  checkActivities(content.termWork, "Term work");
  checkActivities(content.selfLearning, "Self learning");
  if (totals.twHours + totals.slHours !== offering.twSlHours) {
    error(
      "twsl",
      `Term work (${totals.twHours}) + self learning (${totals.slHours}) = ${totals.twHours + totals.slHours} hours; the scheme has ${offering.twSlHours} TW & SL hours.`,
    );
  }

  // --- Course outcomes -------------------------------------------------------------------------------------
  const outcomes = content.outcomes;
  if (outcomes.length < format.coMin || outcomes.length > format.coMax) {
    error("outcomes", `Write ${format.coMin}–${format.coMax} course outcomes (now ${outcomes.length}).`);
  }
  outcomes.forEach((co, i) => {
    const name = `CO${i + 1}`;
    if (!filled(co.statement)) {
      error("outcomes", `${name}: write the statement.`);
      return;
    }
    const level = ctx.bloomLevels.find((l) => l.level === co.level);
    if (!level) error("outcomes", `${name}: choose the learning level.`);
    if (!filled(co.verb)) error("outcomes", `${name}: choose the action verb.`);
    else if (level && !level.verbs.some((v) => sameWord(v, co.verb))) {
      const owner = ctx.bloomLevels.find((l) => l.verbs.some((v) => sameWord(v, co.verb)));
      error(
        "outcomes",
        owner
          ? `${name}: “${co.verb.trim()}” is a ${owner.name} verb, but the level is ${level.name}.`
          : `${name}: “${co.verb.trim()}” is not in the ${level.name} verb list.`,
      );
    }
    if (filled(co.verb) && !containsWord(co.statement, co.verb)) {
      warning("outcomes", `${name}: the statement does not use the action verb “${co.verb.trim()}”.`);
    }
  });

  // --- Mapping (tick marks, D2) --------------------------------------------------------------------------
  outcomes.forEach((co, i) => {
    if (!filled(co.statement)) return;
    if (co.pos.length === 0) error("mapping", `CO${i + 1}: tick at least one PO.`);
    for (const programme of ctx.psoProgrammes ?? []) {
      if (!(co.psos[programme] ?? []).length) warning("mapping", `CO${i + 1}: no PSO of ${programme} is ticked.`);
    }
  });

  return issues;
}

/** Builds the validation `ctx` from the syllabus editor data (GET /api/syllabi/:schemeId/:courseId). */
export function validationContext(data) {
  return {
    format: data.format,
    offerings: data.offerings,
    hoursPerCredit: data.scheme.hoursPerCredit,
    bloomLevels: data.bloomLevels,
    psoProgrammes: data.lists.psos.filter((g) => g.items.length > 0).map((g) => g.programmeCode),
  };
}

/** Counts by severity, for badges. */
export function summarizeIssues(issues) {
  return {
    errors: issues.filter((i) => i.severity === "error").length,
    warnings: issues.filter((i) => i.severity === "warning").length,
  };
}

/** Issue counts per section id: { units: { errors, warnings }, … }, for the editor's section list. */
export function issuesBySection(issues) {
  const out = {};
  for (const issue of issues) {
    out[issue.section] ??= { errors: 0, warnings: 0 };
    out[issue.section][issue.severity === "error" ? "errors" : "warnings"] += 1;
  }
  return out;
}

function isWebLink(value) {
  try {
    const url = new URL(value.trim());
    return (url.protocol === "https:" || url.protocol === "http:") && url.hostname.includes(".");
  } catch {
    return false;
  }
}

const normalizeWord = (w) => w.trim().toLowerCase();
const sameWord = (a, b) => normalizeWord(a) === normalizeWord(b);

/** True when `word` appears in `text` as a whole word, allowing simple endings (apply → applying, applies). */
function containsWord(text, word) {
  const stem = normalizeWord(word)
    .replace(/[^a-z]/g, "")
    .replace(/e$|y$/, "");
  if (!stem) return false;
  return new RegExp(`\\b${stem}[a-z]*\\b`, "i").test(text);
}
