import { describe, expect, it } from "vitest";
import { categories2025, cseCourses2025, schemeRules2025 } from "../../data/scheme-2025.js";
import { expectedHours, validateSchemeCourse } from "./rules.js";
const category = (code) => {
  const c = categories2025.find((x) => x.code === code);
  if (!c) throw new Error(`Unknown category ${code}`);
  return c;
};
const figures = (overrides = {}) => ({
  lCredits: 3,
  tCredits: 0,
  pCredits: 0,
  lHours: 42,
  tHours: 0,
  pHours: 0,
  twSlHours: 48,
  cieMarks: 100,
  seeMarks: 100,
  format: "THEORY",
  ...overrides,
});
describe("2025 scheme (CSE semesters III–IV)", () => {
  it.each(cseCourses2025.map((c) => [c.code, c]))("%s satisfies the scheme rules", (_code, c) => {
    const issues = validateSchemeCourse(
      {
        lCredits: c.credits[0],
        tCredits: c.credits[1],
        pCredits: c.credits[2],
        lHours: c.hours[0],
        tHours: c.hours[1],
        pHours: c.hours[2],
        twSlHours: c.hours[3],
        cieMarks: c.cie,
        seeMarks: c.see,
        format: c.format,
      },
      category(c.category),
      schemeRules2025,
    );
    expect(issues).toEqual([]);
  });
});
describe("expectedHours", () => {
  it("derives semester hours for an IPCC 3:0:1 course", () => {
    const pattern = category("IPCC").creditPatterns[0];
    expect(expectedHours(pattern, schemeRules2025)).toEqual({
      lHours: 42,
      tHours: 0,
      pHours: 28,
      twSlHours: 50,
      total: 120,
    });
  });
  it("handles the SDC exception (1 credit, 2 contact hours per week)", () => {
    const pattern = category("SDC").creditPatterns[0];
    expect(expectedHours(pattern, schemeRules2025)).toMatchObject({ lHours: 28, twSlHours: 2, total: 30 });
  });
});
describe("validateSchemeCourse", () => {
  it("rejects a credit pattern the category does not allow", () => {
    const issues = validateSchemeCourse(figures({ lCredits: 3, pCredits: 1 }), category("PCC"), schemeRules2025);
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({ field: "credits", severity: "error" });
    expect(issues[0].message).toContain("4:0:0, 3:0:0, 2:0:0, 1:0:0");
  });
  it("reports wrong lecture hours with the expected value", () => {
    const issues = validateSchemeCourse(figures({ lHours: 40, twSlHours: 50 }), category("PCC"), schemeRules2025);
    expect(issues.map((i) => i.field)).toEqual(["lHours", "twSlHours"]);
    expect(issues[0].message).toContain("should be 42");
  });
  it("reports a TW & SL value that does not complete the credit hours", () => {
    const issues = validateSchemeCourse(figures({ twSlHours: 40 }), category("PCC"), schemeRules2025);
    expect(issues).toHaveLength(1);
    expect(issues[0].message).toContain("should be 48");
  });
  it("rejects a format the category does not allow", () => {
    const issues = validateSchemeCourse(figures({ format: "LAB" }), category("PCC"), schemeRules2025);
    expect(issues.map((i) => i.field)).toEqual(["format"]);
  });
  it("requires a format when the category needs a syllabus", () => {
    const issues = validateSchemeCourse(figures({ format: null }), category("PCC"), schemeRules2025);
    expect(issues.map((i) => i.field)).toEqual(["format"]);
  });
  it("checks CIE and SEE marks against the category", () => {
    const lab = category("PCCL");
    const issues = validateSchemeCourse(
      {
        lCredits: 0,
        tCredits: 0,
        pCredits: 1,
        lHours: 0,
        tHours: 0,
        pHours: 28,
        twSlHours: 2,
        cieMarks: 100,
        seeMarks: 100,
        format: "LAB",
      },
      lab,
      schemeRules2025,
    );
    expect(issues.map((i) => i.field)).toEqual(["cieMarks", "seeMarks"]);
  });
  it("rejects SEE marks for a category without SEE", () => {
    const issues = validateSchemeCourse(
      {
        lCredits: 1,
        tCredits: 0,
        pCredits: 0,
        lHours: 28,
        tHours: 0,
        pHours: 0,
        twSlHours: 2,
        cieMarks: 100,
        seeMarks: 100,
        format: null,
      },
      category("SDC"),
      schemeRules2025,
    );
    expect(issues.map((i) => i.field)).toEqual(["seeMarks"]);
  });
  it("requires 0 credits for pass/fail courses and skips the hour rule", () => {
    const ncmc = category("NCMC");
    const base = {
      tCredits: 0,
      pCredits: 0,
      lHours: 14,
      tHours: 0,
      pHours: 0,
      twSlHours: 99,
      cieMarks: 100,
      seeMarks: null,
      format: null,
    };
    expect(validateSchemeCourse({ ...base, lCredits: 0 }, ncmc, schemeRules2025)).toEqual([]);
    expect(validateSchemeCourse({ ...base, lCredits: 1 }, ncmc, schemeRules2025).map((i) => i.field)).toEqual([
      "credits",
    ]);
  });
  it("rejects negative or fractional numbers before applying rules", () => {
    const issues = validateSchemeCourse(figures({ lHours: -1, twSlHours: 1.5 }), category("PCC"), schemeRules2025);
    expect(issues.map((i) => i.field)).toEqual(["lHours", "twSlHours"]);
  });
  it("follows a changed scheme setting (16 teaching weeks)", () => {
    const issues = validateSchemeCourse(figures(), category("PCC"), { teachingWeeks: 16, hoursPerCredit: 30 });
    expect(issues.map((i) => i.field)).toEqual(["lHours", "twSlHours"]);
    expect(issues[0].message).toContain("should be 48");
  });
});
