// Syllabus content: the shape of the working copy (README §6) and its running totals. One shape serves
// every format (README Appendix B); the format's counts decide which parts are used:
//   Theory: units · Integrated / Integrated-Project: units + experiments · Lab/AEC: experiments only.
// Pure functions only, shared by the editor (browser) and the API (server).
//
// content = {
//   objectives: string[]                       course learning objectives
//   prerequisites: string
//   units: { title, content, hours }[]         content is plain text (one topic per line is fine)
//   flippedSessions: (number|null)[]           flipped classroom sessions, one entry per unit
//   experiments, openEnded: { title, hours }[] lab experiments (format.experimentCount / openEndedCount)
//   textBooks, referenceBooks: { authors, title, publisher, edition, year }[]
//   eResources: { title, url }[]
//   termWork, selfLearning: { activity, hours }[]
//   outcomes: { statement, verb, level, units[], pos[], psos: { [programmeCode]: string[] }, wks[], sdgs[] }[]
//             units: the unit numbers (1-based) the CO is based on, for the coverage check (README §9)
// }
// PSO ticks are kept per programme because one syllabus serves every programme that lists the course (D13).

export const emptyBook = () => ({ authors: "", title: "", publisher: "", edition: "", year: "" });
export const emptyEResource = () => ({ title: "", url: "" });
export const emptyActivity = () => ({ activity: "", hours: null });
export const emptyUnit = () => ({ title: "", content: "", hours: null });
export const emptyExperiment = () => ({ title: "", hours: null });
export const emptyOutcome = () => ({
  statement: "",
  verb: "",
  level: null,
  units: [],
  pos: [],
  psos: {},
  wks: [],
  sdgs: [],
});

const text = (v) => (typeof v === "string" ? v : "");
const hours = (v) => (Number.isInteger(v) && v >= 0 ? v : null);
const codes = (v) => (Array.isArray(v) ? v.filter((c) => typeof c === "string") : []);
const list = (v, normalize) => (Array.isArray(v) ? v.map((item) => normalize(item ?? {})) : []);
const padTo = (items, count, make) => [...items, ...Array.from({ length: Math.max(0, count - items.length) }, make)];

/** A new, empty syllabus sized for the format (units, experiments, objectives and COs). */
export function emptySyllabusContent(format) {
  return normalizeSyllabusContent({}, format);
}

/**
 * Fills in anything missing so the editor can rely on the shape. Never drops entered data: extra
 * rows stay (validation reports them), and lists are padded up to the format's minimum.
 */
export function normalizeSyllabusContent(raw, format) {
  const c = raw && typeof raw === "object" ? raw : {};
  const units = padTo(
    list(c.units, (u) => ({ title: text(u.title), content: text(u.content), hours: hours(u.hours) })),
    format.unitCount,
    emptyUnit,
  );
  const flipped = Array.isArray(c.flippedSessions) ? c.flippedSessions.map(hours) : [];
  return {
    objectives: padTo(Array.isArray(c.objectives) ? c.objectives.map(text) : [], format.cloMin, () => ""),
    prerequisites: text(c.prerequisites),
    units,
    flippedSessions: padTo(flipped, units.length, () => null).slice(0, units.length),
    experiments: padTo(list(c.experiments, experiment), format.experimentCount ?? 0, emptyExperiment),
    openEnded: padTo(list(c.openEnded, experiment), format.openEndedCount ?? 0, emptyExperiment),
    textBooks: padTo(list(c.textBooks, book), 1, emptyBook),
    referenceBooks: format.hasReferenceBooks ? padTo(list(c.referenceBooks, book), 1, emptyBook) : [],
    eResources: padTo(
      list(c.eResources, (e) => ({ title: text(e.title), url: text(e.url) })),
      1,
      emptyEResource,
    ),
    termWork: padTo(list(c.termWork, activity), 1, emptyActivity),
    selfLearning: padTo(list(c.selfLearning, activity), 1, emptyActivity),
    outcomes: padTo(list(c.outcomes, outcome), format.coMin, emptyOutcome),
  };
}

function book(b) {
  return {
    authors: text(b.authors),
    title: text(b.title),
    publisher: text(b.publisher),
    edition: text(b.edition),
    year: text(b.year),
  };
}

function experiment(e) {
  return { title: text(e.title), hours: hours(e.hours) };
}

function activity(a) {
  return { activity: text(a.activity), hours: hours(a.hours) };
}

function outcome(o) {
  const psos = {};
  if (o.psos && typeof o.psos === "object" && !Array.isArray(o.psos)) {
    for (const [programme, ticked] of Object.entries(o.psos)) psos[programme] = codes(ticked);
  }
  return {
    statement: text(o.statement),
    verb: text(o.verb),
    level: Number.isInteger(o.level) ? o.level : null,
    units: Array.isArray(o.units)
      ? [...new Set(o.units.filter((n) => Number.isInteger(n) && n > 0))].sort((a, b) => a - b)
      : [],
    pos: codes(o.pos),
    psos,
    wks: codes(o.wks),
    sdgs: codes(o.sdgs),
  };
}

const sum = (values) => values.reduce((total, v) => total + (Number.isInteger(v) ? v : 0), 0);

/** Running totals shown in the editor and checked by validation (README §9). */
export function syllabusTotals(content) {
  return {
    unitHours: sum(content.units.map((u) => u.hours)),
    flippedSessions: sum(content.flippedSessions),
    experimentHours: sum([...(content.experiments ?? []), ...(content.openEnded ?? [])].map((e) => e.hours)),
    twHours: sum(content.termWork.map((a) => a.hours)),
    slHours: sum(content.selfLearning.map((a) => a.hours)),
  };
}

/** "Unit – I" … roman numerals used by the Word template. */
export function romanNumeral(n) {
  const numerals = [
    [10, "X"],
    [9, "IX"],
    [5, "V"],
    [4, "IV"],
    [1, "I"],
  ];
  let out = "";
  for (const [value, symbol] of numerals) {
    while (n >= value) {
      out += symbol;
      n -= value;
    }
  }
  return out;
}
