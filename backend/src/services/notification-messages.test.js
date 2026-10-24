import { describe, expect, it } from "vitest";
import { composeEmail, notificationKinds } from "./notification-messages.js";

const appUrl = "https://syllabus.git.edu/";
const recipient = { name: "Asha Kulkarni" };
const base = {
  course: { code: "1BCS304", title: "Data Structures and Applications" },
  schemeId: "s1",
  schemeName: "2025 Scheme",
  path: "/syllabi/s1/c1",
};
const email = (kind, rows) => composeEmail({ kind, rows, recipient, appUrl });

describe("composeEmail", () => {
  it("greets the recipient, links back to the portal and explains how to stop the emails", () => {
    const { subject, text } = email("assignment", [{ ...base, role: "COORDINATOR", by: "BoS CSE" }]);
    expect(subject).toBe("1BCS304: you are the Course Coordinator — Academic Curriculum Portal");
    expect(text.startsWith("Dear Asha Kulkarni,\n")).toBe(true);
    expect(text).toContain("as Course Coordinator.");
    expect(text).toContain("Assigned by BoS CSE.");
    expect(text).toContain("https://syllabus.git.edu/syllabi/s1/c1");
    expect(text).toContain("Turn them off under My account: https://syllabus.git.edu/account");
    expect(text).not.toContain("null");
  });

  it("collects several review inputs into one digest", () => {
    const rows = [
      { ...base, stage: "INTERNAL_BOS", section: "Unit II" },
      { ...base, stage: "INTERNAL_BOS", section: "CO3" },
      { ...base, stage: "INTERNAL_BOS", section: "Unit II" },
    ];
    const { subject, text } = email("inputs", rows);
    expect(subject).toMatch(/^1BCS304: 3 new review inputs to answer/);
    expect(text).toContain(
      "3 review inputs were recorded for 1BCS304 Data Structures and Applications in the Internal BOS stage.",
    );
    expect(text).toContain("Sections: Unit II, CO3.");
    expect(text).toContain("/syllabi/s1/c1/review");
    expect(email("inputs", rows.slice(0, 1)).subject).toMatch(/^1BCS304: 1 new review input to answer/);
  });

  it("names the stages and versions of a closed stage and an approval", () => {
    const closed = email("stageClosed", [{ ...base, fromStage: "INTERNAL_BOS", toStage: "EXPERT", version: "V2.0" }]);
    expect(closed.subject).toMatch(/^1BCS304 moved to the Industry Experts & Alumni stage \(V2\.0\)/);
    const approved = email("approved", [
      { ...base, version: "V4.0", approvedOn: "2026-10-20", reference: "AC/2026/14" },
    ]);
    expect(approved.subject).toMatch(/^1BCS304 approved: V4\.0 is the official syllabus/);
    expect(approved.text).toContain("approved on 20 October 2026 (AC/2026/14)");
    expect(approved.text).toContain("/approved-syllabi?scheme=s1&approved.q=1BCS304");
  });

  it("lists every course and change in one 'needs revision' digest", () => {
    const other = { ...base, course: { code: "1BCS402", title: "Operating Systems" }, path: "/syllabi/s1/c2" };
    const { subject, text } = email("needsRevision", [
      { ...base, summary: "PCC credits changed" },
      { ...other, summary: "PCC credits changed" },
      { ...base, summary: "Theory text block updated" },
    ]);
    expect(subject).toMatch(/^2 syllabi need revision after a scheme change/);
    expect(text.match(/PCC credits changed/g)).toHaveLength(1);
    expect(text).toContain("Theory text block updated");
    expect(text).toContain("1BCS402 Operating Systems: https://syllabus.git.edu/syllabi/s1/c2");
  });

  it("builds every kind without leaving placeholders", () => {
    const full = {
      ...base,
      role: "CO_AUTHOR",
      by: "X",
      version: "V1.0",
      stage: "EXPERT",
      section: "CO1",
      reviewer: "Dr. R",
      fromStage: "EXPERT",
      toStage: "EXTERNAL_BOS",
      reason: "Typo",
      from: "V4.0",
      summary: "Change",
      approvedOn: "2026-01-01",
      reference: "R1",
    };
    for (const kind of notificationKinds) {
      const { subject, text } = email(kind, [full]);
      expect(subject.length).toBeGreaterThan(20);
      expect(text).not.toMatch(/undefined|null|\[object/);
    }
  });

  it("refuses an unknown kind or no rows", () => {
    expect(() => email("nope", [base])).toThrow(/Unknown notification kind/);
    expect(() => email("inputs", [])).toThrow(/at least one row/);
  });
});
