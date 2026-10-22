import { describe, expect, it } from "vitest";
import { saveSyllabusSchema, theoryContentSchema } from "../../schemas/syllabus.js";
import { emptyTheoryContent, normalizeTheoryContent, romanNumeral, theoryTotals } from "./theory.js";

const format = { unitCount: 5, cloMin: 4, coMin: 4, hasReferenceBooks: true };

describe("Theory syllabus content", () => {
  it("starts empty, sized for the format, and passes the save schema", () => {
    const c = emptyTheoryContent(format);
    expect(c.units).toHaveLength(5);
    expect(c.flippedSessions).toHaveLength(5);
    expect(c.objectives).toHaveLength(4);
    expect(c.outcomes).toHaveLength(4);
    expect(theoryContentSchema.safeParse(c).success).toBe(true);
    // The first save of a new syllabus is based on revision 0.
    expect(saveSyllabusSchema.safeParse({ revision: 0, content: c }).success).toBe(true);
  });

  it("keeps entered data, fills gaps and drops unknown or wrongly typed values", () => {
    const c = normalizeTheoryContent(
      {
        units: [{ title: "Arrays", hours: 8, extra: "x" }],
        outcomes: [{ statement: "Apply stacks", level: 3, pos: ["PO1", 7], psos: { "BE-CSE": ["PSO1"] } }],
        flippedSessions: [2, -1, "3"],
        junk: true,
      },
      format,
    );
    expect(c.units[0]).toEqual({ title: "Arrays", content: "", hours: 8 });
    expect(c.units).toHaveLength(5);
    expect(c.flippedSessions).toEqual([2, null, null, null, null]);
    expect(c.outcomes[0]).toMatchObject({ level: 3, pos: ["PO1"], psos: { "BE-CSE": ["PSO1"] } });
    expect(c).not.toHaveProperty("junk");
  });

  it("has no reference books when the format excludes them", () => {
    expect(emptyTheoryContent({ ...format, hasReferenceBooks: false }).referenceBooks).toEqual([]);
  });

  it("adds up unit hours, flipped sessions, TW and SL", () => {
    const c = emptyTheoryContent(format);
    c.units.forEach((u, i) => (u.hours = [8, 8, 9, 9, 8][i]));
    c.flippedSessions = [1, 1, 2, null, 1];
    c.termWork = [{ activity: "Assignment", hours: 20 }];
    c.selfLearning = [
      { activity: "MOOC", hours: 18 },
      { activity: "Reading", hours: null },
    ];
    expect(theoryTotals(c)).toEqual({ unitHours: 42, flippedSessions: 5, twHours: 20, slHours: 18 });
  });

  it("writes unit numbers as roman numerals", () => {
    expect([1, 2, 3, 4, 5, 9].map(romanNumeral)).toEqual(["I", "II", "III", "IV", "V", "IX"]);
  });
});
