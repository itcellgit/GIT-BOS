import { describe, expect, it } from "vitest";
import { bookLinkPrefix, renderBookFrontMatter } from "./book-layout.js";

const course = (code, entry) => ({
  code,
  title: `Course ${code}`,
  category: "PCC",
  credits: "3:0:0",
  lHours: 42,
  tHours: 0,
  pHours: 0,
  twSlHours: 48,
  cieMarks: 50,
  seeMarks: 50,
  entry,
  page: entry == null ? null : 5 + entry,
});
const base = {
  institution: { name: "Test Institute" },
  scheme: { name: "2025 Scheme" },
  fontUrl: (f) => f,
};

describe("syllabus book front matter", () => {
  it("prints one programme", () => {
    const html = renderBookFrontMatter({
      ...base,
      programme: { code: "BE-CSE", name: "Computer Science" },
      semesters: [{ semester: 3, courses: [course("CS31", 0)] }],
    });
    expect(html).toContain("Computer Science");
    expect(html).toContain("Semester 3");
    expect(html).not.toContain('class="part"');
  });

  it("prints every programme of a whole-scheme book, linking a shared course to one entry", () => {
    const shared = course("MA31", 0);
    const html = renderBookFrontMatter({
      ...base,
      parts: [
        { programme: { code: "BE-CSE", name: "Computer Science" }, semesters: [{ semester: 3, courses: [shared] }] },
        {
          programme: { code: "BE-ECE", name: "Electronics" },
          semesters: [{ semester: 4, courses: [shared, course("EC41", null)] }],
        },
      ],
    });
    expect(html).toContain("All programmes");
    expect(html).toContain("Semesters 3, 4");
    expect(html).toContain("BE-CSE – Computer Science");
    expect(html).toContain("BE-ECE – Electronics");
    expect(html.split(`${bookLinkPrefix}0"`)).toHaveLength(3); // the shared course's two contents rows
    expect(html).toContain("Not included"); // EC41 has no approved syllabus
  });
});
