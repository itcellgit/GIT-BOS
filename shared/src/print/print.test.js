import { describe, expect, it } from "vitest";
import { bloomLevels } from "../data/scheme-2025.js";
import { emptySyllabusContent } from "../domain/syllabi/content.js";
import { escapeHtml, renderRichText } from "./rich-text.js";
import { renderSyllabusLayout } from "./syllabus-layout.js";

describe("standard text formatting", () => {
  it("escapes HTML and applies bold", () => {
    expect(escapeHtml(`<b>"x" & 'y'</b>`)).toBe("&lt;b&gt;&quot;x&quot; &amp; &#39;y&#39;&lt;/b&gt;");
    expect(renderRichText("**IA Test:** <script>x</script>")).toBe(
      "<p><strong>IA Test:</strong> &lt;script&gt;x&lt;/script&gt;</p>",
    );
  });

  it("builds tables, lists and paragraphs line by line", () => {
    const html = renderRichText(
      [
        "| Components | Marks |",
        "|---|---|",
        "| IA tests | 30+30<br>= 60 |",
        "| Note spanning |",
        "",
        "- one",
        "- two",
        "1. first",
        "Closing line",
      ].join("\n"),
    );
    expect(html).toContain("<thead><tr><th>Components</th><th>Marks</th></tr></thead>");
    expect(html).toContain("<td>30+30<br>= 60</td>");
    expect(html).toContain(`<td colspan="2">Note spanning</td>`);
    expect(html).toContain("<ul><li>one</li><li>two</li></ul>");
    expect(html).toContain("<ol><li>first</li></ol>");
    expect(html).toContain("<p>Closing line</p>");
  });
});

describe("Theory print layout", () => {
  const format = {
    title: "UG Detailed Syllabus Template",
    unitCount: 5,
    cloMin: 4,
    coMin: 4,
    hasReferenceBooks: true,
    prerequisiteLabel: "Pre-requisites",
  };
  const doc = (content, overrides = {}) => ({
    institution: { name: "KLS Gogte Institute of Technology", shortName: "KLS GIT" },
    scheme: { name: "2025 Scheme", teachingWeeks: 14, hoursPerCredit: 30 },
    course: { code: "1BCS304", title: "Data Structures" },
    offerings: [
      {
        programme: { code: "BE-CSE", name: "B.E. CSE" },
        semester: 3,
        category: { code: "PCC" },
        lCredits: 3,
        tCredits: 0,
        pCredits: 0,
        lHours: 42,
        tHours: 0,
        pHours: 0,
        twSlHours: 48,
        cieMarks: 100,
        seeMarks: 100,
      },
    ],
    format,
    content,
    lists: { pos: [{ code: "PO1" }, { code: "PO2" }], psos: [{ programmeCode: "BE-CSE", items: [{ code: "PSO1" }] }] },
    bloomLevels,
    textBlocks: [
      { kind: "CIE_SCHEME", yearOfStudy: 2, title: "CIE (2nd year)", body: "| A | B |\n| 1 | 2 |" },
      { kind: "CIE_SCHEME", yearOfStudy: 3, title: "CIE (3rd year)", body: "Project" },
    ],
    status: { label: "Draft – working copy", draft: true },
    generatedAt: new Date("2026-10-15T10:00:00Z"),
    ...overrides,
  });

  it("prints the header from the scheme and escapes faculty text", () => {
    const c = emptySyllabusContent(format);
    c.units[0] = { title: "Stacks <img src=x>", content: "Push\nPop", hours: 8 };
    c.outcomes[0] = {
      statement: "Apply stacks & queues",
      verb: "apply",
      level: 3,
      pos: ["PO2"],
      psos: { "BE-CSE": ["PSO1"] },
      wks: ["WK3"],
      sdgs: [],
    };
    const html = renderSyllabusLayout(doc(c));
    expect(html).toContain("DATA STRUCTURES");
    expect(html).toContain("<td>1BCS304</td>");
    expect(html).toContain("Total = 90 Hrs");
    expect(html).toContain("Unit – I: Stacks &lt;img src=x&gt;");
    expect(html).not.toContain("<img");
    expect(html).toContain("Push<br>Pop");
    expect(html).toContain("<strong>Apply</strong> stacks &amp; queues");
    expect(html).toContain(`<div class="watermark" aria-hidden="true">DRAFT</div>`);
  });

  it("uses the CIE scheme for the course's year of study only", () => {
    const html = renderSyllabusLayout(doc(emptySyllabusContent(format)));
    expect(html).toContain("CIE (2nd year)");
    expect(html).not.toContain("CIE (3rd year)");
  });

  it("has no watermark once approved", () => {
    const html = renderSyllabusLayout(
      doc(emptySyllabusContent(format), { status: { label: "V4.0 – Approved", draft: false } }),
    );
    expect(html).not.toContain(`class="watermark"`);
    expect(html).toContain(`content: "V4.0 – Approved"`);
  });

  it("prints a Lab/AEC syllabus: experiments instead of units, no flipped classroom or reference books", () => {
    const lab = {
      ...format,
      title: "UG Detailed Syllabus Template for Lab course/ AEC",
      unitCount: 0,
      experimentCount: 2,
      openEndedCount: 1,
      hasReferenceBooks: false,
      prerequisiteLabel: "Required Knowledge of",
    };
    const c = emptySyllabusContent(lab);
    c.experiments = [
      { title: "Linked list <operations>", hours: 2 },
      { title: "Binary search tree", hours: 2 },
    ];
    c.openEnded = [{ title: "Mini project", hours: 4 }];
    const html = renderSyllabusLayout(doc(c, { format: lab }));
    expect(html).toContain("List of Experiments");
    expect(html).toContain("Linked list &lt;operations&gt;");
    expect(html).toContain("Open-ended experiments");
    expect(html).toContain("Required Knowledge of");
    expect(html).not.toContain("Unit – I");
    expect(html).not.toContain("Flipped Classroom Details");
    expect(html).not.toContain("Reference Books:");
  });

  it("prints an Integrated syllabus with both units and the practical component", () => {
    const integrated = { ...format, experimentCount: 1, openEndedCount: 0 };
    const c = emptySyllabusContent(integrated);
    c.experiments = [{ title: "Implement a stack", hours: 2 }];
    const html = renderSyllabusLayout(doc(c, { format: integrated }));
    expect(html).toContain("Unit – I");
    expect(html).toContain("Practical Component");
  });
});
