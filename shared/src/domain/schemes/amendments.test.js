import { describe, expect, it } from "vitest";
import { amendmentScope, amendmentSummary, schemeRulesChanged } from "./amendments.js";

describe("amendment scope (README §5)", () => {
  it("flags every syllabus for scheme rules, outcome lists and Bloom levels", () => {
    for (const action of ["scheme.update", "outcome.update", "outcome.delete", "bloom.update"]) {
      expect(amendmentScope(action)).toEqual({ kind: "all" });
    }
  });

  it("limits category and credit-pattern changes to that category", () => {
    expect(amendmentScope("category.update", { categoryId: "c1" })).toEqual({ kind: "category", categoryId: "c1" });
    expect(amendmentScope("creditPattern.delete", { categoryId: "c1" })).toEqual({
      kind: "category",
      categoryId: "c1",
    });
  });

  it("limits format changes to syllabi of that format", () => {
    expect(amendmentScope("format.update", { format: "LAB" })).toEqual({ kind: "format", format: "LAB" });
  });

  it("records new categories and printed text without flagging syllabi", () => {
    expect(amendmentScope("category.create")).toEqual({ kind: "none" });
    expect(amendmentScope("textBlock.update")).toEqual({ kind: "none" });
  });
});

describe("scheme rule changes", () => {
  it("ignores name and framework edits", () => {
    expect(schemeRulesChanged({ teachingWeeks: 14, hoursPerCredit: 30 }, { name: "New", teachingWeeks: 14 })).toBe(
      false,
    );
  });

  it("detects a change to weeks or hours per credit", () => {
    expect(
      schemeRulesChanged({ teachingWeeks: 14, hoursPerCredit: 30 }, { teachingWeeks: 14, hoursPerCredit: 32 }),
    ).toBe(true);
  });
});

describe("amendment summary", () => {
  it("names the rule and both values", () => {
    expect(
      amendmentSummary("scheme.update", {
        before: { teachingWeeks: 14, hoursPerCredit: 30 },
        after: { teachingWeeks: 15, hoursPerCredit: 30 },
      }),
    ).toBe("Teaching weeks 14 → 15");
  });

  it("describes categories, patterns and formats", () => {
    expect(amendmentSummary("category.update", { code: "PCC" })).toBe("Category PCC changed");
    expect(amendmentSummary("creditPattern.create", { code: "IPCC", pattern: "3:0:1" })).toBe(
      "Credit pattern 3:0:1 added in IPCC",
    );
    expect(amendmentSummary("format.update", { format: "LAB" })).toBe("Lab / AEC format settings changed");
    expect(amendmentSummary("outcome.delete", { kind: "PO", code: "PO11" })).toBe("PO PO11 removed");
  });
});
