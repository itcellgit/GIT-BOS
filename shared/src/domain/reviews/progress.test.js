import { describe, expect, it } from "vitest";
import { progressByGroup, progressStep, progressSteps } from "./progress.js";

describe("progress step (dashboards)", () => {
  it("maps each workflow state to one step", () => {
    expect(progressStep(null)).toBe("NOT_STARTED");
    expect(progressStep({ status: "DRAFT", stage: null })).toBe("DRAFT");
    expect(progressStep({ status: "IN_REVIEW", stage: "EXPERT" })).toBe("EXPERT");
    expect(progressStep({ status: "APPROVED", stage: null })).toBe("APPROVED");
    expect(progressStep({ status: "REVISING", stage: null })).toBe("REVISING");
  });

  it("keeps the path in order", () => {
    expect(progressSteps[0]).toBe("NOT_STARTED");
    expect(progressSteps.at(-1)).toBe("APPROVED");
  });
});

describe("progress by group", () => {
  const rows = [
    { step: "DRAFT", programmes: ["BE-CSE"], semester: 3 },
    { step: "APPROVED", programmes: ["BE-CSE", "BE-ISE"], semester: 3 },
    { step: "NOT_STARTED", programmes: ["BE-ISE"], semester: 10 },
  ];

  it("counts a shared course once in each programme", () => {
    const byProgramme = progressByGroup(rows, (r) => r.programmes);
    expect(byProgramme.map((g) => [g.key, g.total])).toEqual([
      ["BE-CSE", 2],
      ["BE-ISE", 2],
    ]);
    expect(byProgramme[1].counts.APPROVED).toBe(1);
    expect(byProgramme[1].counts.NOT_STARTED).toBe(1);
  });

  it("sorts numeric keys naturally", () => {
    expect(progressByGroup(rows, (r) => [String(r.semester)]).map((g) => g.key)).toEqual(["3", "10"]);
  });
});
