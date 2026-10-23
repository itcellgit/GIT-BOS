import { describe, expect, it } from "vitest";
import { emptySyllabusContent } from "../syllabi/content.js";
import { compareSyllabi, diffLines } from "./compare.js";
import {
  nextVersion,
  pendingInputs,
  sectionRefLabel,
  stageAfter,
  versionStatusLabel,
  workflowBlocker,
} from "./workflow.js";

const state = (over = {}) => ({
  status: "IN_REVIEW",
  stage: "INTERNAL_BOS",
  major: 1,
  minor: 0,
  hasUncommittedChanges: false,
  saved: true,
  errorCount: 0,
  pendingCount: 0,
  versionsSinceApproval: 0,
  ...over,
});

describe("version numbering (README §7)", () => {
  it("walks the whole path V1.0 → V4.0 → V4.1", () => {
    const steps = [];
    let s = state({ status: "DRAFT", stage: null, major: 0, minor: 0 });
    const apply = (event, changes = {}) => {
      s = { ...s, ...changes };
      const v = nextVersion(s, event);
      if (v) s = { ...s, ...v, hasUncommittedChanges: false };
      steps.push(`V${s.major}.${s.minor}`);
    };
    apply("submit", { status: "IN_REVIEW" });
    s.stage = "INTERNAL_BOS";
    apply("commit", { hasUncommittedChanges: true }); // edits before the Internal BOS meeting
    apply("close", { hasUncommittedChanges: true });
    s.stage = stageAfter("INTERNAL_BOS");
    apply("commit", { hasUncommittedChanges: true }); // first expert's inputs
    apply("commit", { hasUncommittedChanges: true }); // second expert's inputs
    apply("close"); // nothing new since the last expert: no version
    s.stage = stageAfter("EXPERT");
    apply("close", { hasUncommittedChanges: true });
    s.stage = stageAfter("EXTERNAL_BOS");
    apply("close");
    expect(stageAfter("ACADEMIC_COUNCIL")).toBeNull();
    apply("commit", { status: "REVISING", hasUncommittedChanges: true }); // after an unlock
    expect(steps).toEqual(["V1.0", "V1.1", "V2.0", "V2.1", "V2.2", "V2.2", "V3.0", "V4.0", "V4.1"]);
  });

  it("closing the expert stage keeps uncommitted changes as a minor version", () => {
    expect(nextVersion(state({ stage: "EXPERT", major: 2, minor: 1, hasUncommittedChanges: true }), "close")).toEqual({
      major: 2,
      minor: 2,
    });
  });

  it("labels versions for print", () => {
    expect(versionStatusLabel({ major: 2, minor: 1, stage: "EXPERT" })).toBe("V2.1 – Industry Experts & Alumni review");
    expect(versionStatusLabel({ major: 4, minor: 0, stage: null }, { official: true })).toBe("V4.0 – Final (Approved)");
  });
});

describe("workflow guards", () => {
  it("submits only a saved draft without errors", () => {
    expect(workflowBlocker("submit", state({ status: "DRAFT", saved: false }))).toMatch(/Nothing has been saved/);
    expect(workflowBlocker("submit", state({ status: "DRAFT", errorCount: 2 }))).toMatch(/2 errors/);
    expect(workflowBlocker("submit", state({ status: "DRAFT" }))).toBeNull();
    expect(workflowBlocker("submit", state())).toMatch(/already been submitted/);
  });

  it("refuses to close a stage while inputs are pending (rule 3)", () => {
    expect(workflowBlocker("close", state({ pendingCount: 1 }))).toMatch(/1 input still needs/);
    expect(workflowBlocker("close", state())).toBeNull();
  });

  it("commits only when something changed", () => {
    expect(workflowBlocker("commit", state())).toMatch(/no changes since V1.0/);
    expect(workflowBlocker("commit", state({ hasUncommittedChanges: true }))).toBeNull();
  });

  it("unlocks only an approved syllabus and re-approves only after a correction", () => {
    expect(workflowBlocker("unlock", state())).not.toBeNull();
    expect(workflowBlocker("unlock", state({ status: "APPROVED" }))).toBeNull();
    expect(workflowBlocker("approve", state({ status: "REVISING" }))).toMatch(/Nothing has changed/);
    expect(workflowBlocker("approve", state({ status: "REVISING", versionsSinceApproval: 1 }))).toBeNull();
  });

  it("counts inputs without an action taken or a decision as pending", () => {
    const inputs = [
      { actionTaken: "Done", decision: "ACCEPTED" },
      { actionTaken: " ", decision: "ACCEPTED" },
      { actionTaken: "Done", decision: null },
    ];
    expect(pendingInputs(inputs)).toHaveLength(2);
  });

  it("labels section references", () => {
    expect(sectionRefLabel("unit:3")).toBe("Unit 3");
    expect(sectionRefLabel("co:2")).toBe("CO2");
    expect(sectionRefLabel("books")).toBe("Books and e-resources");
  });
});

describe("version comparison", () => {
  it("diffs lines", () => {
    expect(diffLines(["a", "b", "c"], ["a", "x", "c"])).toEqual([
      { type: "same", text: "a" },
      { type: "removed", text: "b" },
      { type: "added", text: "x" },
      { type: "same", text: "c" },
    ]);
  });

  it("reports only the sections that changed", () => {
    const format = { unitCount: 5, cloMin: 1, coMin: 1, hasReferenceBooks: true };
    const before = emptySyllabusContent(format);
    const after = structuredClone(before);
    after.units[2].title = "Graphs";
    const changed = compareSyllabi(before, after).filter((s) => s.changed);
    expect(changed.map((s) => s.section)).toEqual(["units"]);
    expect(changed[0].lines.find((l) => l.type === "added").text).toMatch(/^Unit 3: Graphs/);
  });
});
