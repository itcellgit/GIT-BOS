import { describe, expect, it } from "vitest";
import { actionTakenHtml } from "./action-taken-document.js";

const review = {
  institution: { name: "KLS Gogte Institute of Technology", shortName: "KLS GIT", address: "Belagavi" },
  scheme: { name: "2025 Scheme" },
  course: { code: "1BCS304", title: "Data Structures" },
  semesters: [3],
  inputs: [
    {
      stage: "INTERNAL_BOS",
      sectionRef: "unit:2",
      inputText: "Add <b>heaps</b> to unit 2.",
      givenBy: { name: "Dr. A. Rao", category: "INTERNAL_BOS", designation: "Professor", organisation: "KLS GIT" },
      meeting: { id: "m1", heldAt: "2026-10-20T05:00:00.000Z", venue: "Seminar Hall 1" },
      actionTaken: "Heaps added to unit 2.",
      decision: "ACCEPTED",
      reviewedLabel: "V1.0",
      resultingLabel: "V2.0",
    },
    {
      stage: "EXPERT",
      sectionRef: "books",
      inputText: "Use the 4th edition.",
      givenBy: null,
      meeting: null,
      actionTaken: null,
      decision: null,
      reviewedLabel: "V2.0",
      resultingLabel: null,
    },
  ],
  unlocks: [
    {
      stage: "ACADEMIC_COUNCIL",
      fromLabel: "V4.0",
      reason: "Typo in CO3",
      createdAt: "2026-11-02T06:00:00Z",
      by: "BoS",
    },
  ],
};

describe("Action Taken report", () => {
  it("prints the stage heading, the meeting and one row per input of that stage", () => {
    const html = actionTakenHtml(review, "INTERNAL_BOS", { fontUrl: (f) => f });
    expect(html).toContain("Action Taken Report – Post Internal BOS");
    expect(html).toContain("Seminar Hall 1");
    expect(html).toContain("Dr. A. Rao");
    expect(html).toContain("Unit 2 · on V1.0");
    expect(html).toContain("Accepted · incorporated in V2.0");
    expect(html).not.toContain("4th edition"); // another stage
  });

  it("escapes reviewer text", () => {
    const html = actionTakenHtml(review, "INTERNAL_BOS", { fontUrl: (f) => f });
    expect(html).toContain("Add &lt;b&gt;heaps&lt;/b&gt; to unit 2.");
    expect(html).not.toContain("<b>heaps</b>");
  });

  it("marks pending actions and shows unlocks as extra rows", () => {
    expect(actionTakenHtml(review, "EXPERT", { fontUrl: (f) => f })).toContain("Pending");
    const council = actionTakenHtml(review, "ACADEMIC_COUNCIL", { fontUrl: (f) => f });
    expect(council).toContain("Unlocked after V4.0");
    expect(council).toContain("Typo in CO3");
  });
});
