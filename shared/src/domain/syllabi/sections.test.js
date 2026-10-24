import { describe, expect, it } from "vitest";
import { resolveSections, sectionEnabled, sectionIds, sectionLabel } from "./sections.js";

describe("syllabus section layout (README §5, §8)", () => {
  it("uses the template order, all on, default headings when nothing is set", () => {
    const sections = resolveSections({ sections: null });
    expect(sections.map((s) => s.id)).toEqual(sectionIds);
    expect(sections.every((s) => s.enabled)).toBe(true);
    expect(sectionLabel({}, "books")).toBe("Books");
  });

  it("applies the Dean's order, switches and headings", () => {
    // The settings screen always saves the full list: here the outcomes are moved to the front.
    const format = {
      sections: [
        { id: "outcomes", label: "Course Outcomes" },
        ...sectionIds
          .filter((id) => id !== "outcomes")
          .map((id) => (id === "flipped" ? { id, enabled: false } : { id })),
      ],
    };
    const ids = resolveSections(format).map((s) => s.id);
    expect(ids.slice(0, 3)).toEqual(["outcomes", "objectives", "prerequisites"]);
    expect(ids).toHaveLength(sectionIds.length);
    expect(sectionLabel(format, "outcomes")).toBe("Course Outcomes");
    expect(sectionEnabled(format, "flipped")).toBe(false);
  });

  it("never turns off a required section, and ignores unknown or repeated ids and blank labels", () => {
    const format = {
      sections: [
        { id: "outcomes", enabled: false, label: "   " },
        { id: "nonsense" },
        { id: "outcomes", label: "Twice" },
      ],
    };
    expect(sectionEnabled(format, "outcomes")).toBe(true);
    expect(sectionLabel(format, "outcomes")).toBe("Course Outcome (COs)");
    expect(resolveSections(format)).toHaveLength(sectionIds.length);
  });

  it("keeps a section missing from a stored list in its default neighbourhood", () => {
    const format = { sections: sectionIds.filter((id) => id !== "books").map((id) => ({ id })) };
    const ids = resolveSections(format).map((s) => s.id);
    expect(ids.indexOf("books")).toBe(sectionIds.indexOf("books"));
  });
});
