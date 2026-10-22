import { describe, expect, it } from "vitest";
import { bloomLevels } from "../../data/scheme-2025.js";
import { emptyTheoryContent } from "./theory.js";
import { summarizeIssues, validateTheory } from "./validate.js";

const format = { unitCount: 5, cloMin: 4, cloMax: 6, coMin: 4, coMax: 6, hasReferenceBooks: true };
const offering = {
  programme: { code: "BE-CSE" },
  category: { code: "PCC", passFail: false },
  lCredits: 3,
  tCredits: 0,
  pCredits: 0,
  lHours: 42,
  tHours: 0,
  pHours: 0,
  twSlHours: 48,
};
const ctx = { format, offerings: [offering], hoursPerCredit: 30, bloomLevels, psoProgrammes: ["BE-CSE"] };

/** A complete 3-credit Theory syllabus that passes every rule. */
function completeContent() {
  const c = emptyTheoryContent(format);
  c.objectives = ["Explain stacks", "Use queues", "Apply trees", "Analyse graphs"];
  c.prerequisites = "Programming in C";
  c.units = [8, 8, 9, 9, 8].map((hours, i) => ({ title: `Topic ${i + 1}`, content: "Lots of topics", hours }));
  c.flippedSessions = [1, 1, 1, 1, 1];
  c.textBooks = [{ authors: "Knuth", title: "TAOCP", publisher: "AW", edition: "3rd", year: "1997" }];
  c.eResources = [{ title: "NPTEL DS", url: "https://nptel.ac.in/courses/106102064" }];
  c.termWork = [{ activity: "Assignments", hours: 28 }];
  c.selfLearning = [{ activity: "MOOC", hours: 20 }];
  c.outcomes = [
    ["Explain how linear data structures work", "explain", 2],
    ["Apply stacks and queues to solve problems", "apply", 3],
    ["Implement trees and their traversals", "implement", 3],
    ["Analyse graph algorithms for efficiency", "analyse", 4],
  ].map(([statement, verb, level]) => ({
    statement,
    verb,
    level,
    pos: ["PO1"],
    psos: { "BE-CSE": ["PSO1"] },
    wks: [],
    sdgs: [],
  }));
  return c;
}

const messages = (issues, severity) => issues.filter((i) => i.severity === severity).map((i) => i.message);

describe("Theory syllabus validation (README §9)", () => {
  it("passes a complete syllabus", () => {
    expect(validateTheory(completeContent(), ctx)).toEqual([]);
  });

  it("reports an empty syllabus with errors in every section, but no crash", () => {
    const issues = validateTheory(emptyTheoryContent(format), ctx);
    const sections = new Set(issues.filter((i) => i.severity === "error").map((i) => i.section));
    expect([...sections].sort()).toEqual(["books", "objectives", "outcomes", "prerequisites", "twsl", "units"]);
  });

  it("checks unit hours against the scheme's lecture hours", () => {
    const c = completeContent();
    c.units[0].hours = 7;
    expect(messages(validateTheory(c, ctx), "error")).toEqual([
      "Unit hours add up to 41; the scheme has 42 lecture hours.",
    ]);
  });

  it("checks TW + SL against the scheme's TW & SL hours", () => {
    const c = completeContent();
    c.selfLearning.push({ activity: "", hours: 4 });
    expect(messages(validateTheory(c, ctx), "error")).toEqual([
      "Self learning row 2: describe the activity.",
      "Term work (28) + self learning (24) = 52 hours; the scheme has 48 TW & SL hours.",
    ]);
  });

  it("checks the number of objectives and COs from the format", () => {
    const c = completeContent();
    c.objectives = ["One", "", "Two"];
    c.outcomes = c.outcomes.slice(0, 3);
    expect(messages(validateTheory(c, ctx), "error")).toEqual([
      "Write 4–6 course learning objectives (now 2).",
      "Write 4–6 course outcomes (now 3).",
    ]);
  });

  it("checks the CO verb against the chosen Bloom level", () => {
    const c = completeContent();
    c.outcomes[1].verb = "design"; // a Create verb on an Apply CO
    c.outcomes[2].verb = "foo";
    c.outcomes[3].level = null;
    const errors = messages(validateTheory(c, ctx), "error");
    expect(errors).toContain("CO2: “design” is a Create verb, but the level is Apply.");
    expect(errors).toContain("CO3: “foo” is not in the Apply verb list.");
    expect(errors).toContain("CO4: choose the learning level.");
  });

  it("warns when the statement does not use the verb, accepting word endings", () => {
    const c = completeContent();
    c.outcomes[0].statement = "Explaining linear data structures";
    c.outcomes[1].statement = "Use stacks to solve problems";
    expect(messages(validateTheory(c, ctx), "warning")).toEqual([
      "CO2: the statement does not use the action verb “apply”.",
    ]);
  });

  it("needs at least one PO per CO and warns about missing PSOs", () => {
    const c = completeContent();
    c.outcomes[0].pos = [];
    c.outcomes[1].psos = {};
    const issues = validateTheory(c, ctx);
    expect(messages(issues, "error")).toEqual(["CO1: tick at least one PO."]);
    expect(messages(issues, "warning")).toEqual(["CO2: no PSO of BE-CSE is ticked."]);
  });

  it("checks books and e-resource links, ignoring blank rows", () => {
    const c = completeContent();
    c.textBooks.push({ authors: "", title: "", publisher: "", edition: "", year: "" });
    c.referenceBooks = [{ authors: "Cormen", title: "", publisher: "MIT", edition: "", year: "" }];
    c.eResources.push({ title: "Bad", url: "nptel course" });
    const issues = validateTheory(c, ctx);
    expect(messages(issues, "error")).toEqual([
      "Reference book 1: add the title.",
      "E-resource 2: “nptel course” is not a valid web link (https://…).",
    ]);
    expect(messages(issues, "warning")).toEqual(["Reference book 1: give the edition or year."]);
  });

  it("flags flipped sessions above the unit's hours, and none at all as a warning", () => {
    const c = completeContent();
    c.flippedSessions = [9, null, null, null, null];
    expect(messages(validateTheory(c, ctx), "error")).toEqual([
      "Unit I: 9 flipped sessions is more than its 8 contact hours.",
    ]);
    c.flippedSessions = [null, null, null, null, null];
    expect(messages(validateTheory(c, ctx), "warning")).toEqual(["No flipped classroom sessions are planned."]);
  });

  it("checks the scheme row itself (L + T + P + TW&SL = 30 × credits), except pass/fail", () => {
    const wrong = { ...offering, twSlHours: 40 };
    const c = completeContent();
    c.selfLearning[0].hours = 12;
    const header = validateTheory(c, { ...ctx, offerings: [wrong] }).filter((i) => i.section === "header");
    expect(header).toHaveLength(1);
    expect(header[0].message).toMatch(/is 82 hours but 3 credits need 90/);
    const passFail = { ...wrong, category: { code: "NCMC", passFail: true } };
    expect(validateTheory(c, { ...ctx, offerings: [passFail] }).filter((i) => i.section === "header")).toEqual([]);
  });

  it("summarises errors and warnings", () => {
    expect(summarizeIssues([{ severity: "error" }, { severity: "warning" }, { severity: "error" }])).toEqual({
      errors: 2,
      warnings: 1,
    });
  });
});
