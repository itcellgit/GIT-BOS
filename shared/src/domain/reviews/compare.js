// Section-by-section comparison of two syllabus versions (README §6: "section-level comparison between
// any two versions"). Each section is turned into plain text lines, then the lines are compared.

const bookLine = (b) =>
  [b.authors, b.title, b.publisher, b.edition, b.year]
    .map((v) => v?.trim())
    .filter(Boolean)
    .join(", ");
const hoursOf = (h) => (h === null || h === undefined ? "–" : `${h} h`);
const nonEmpty = (lines) => lines.filter((l) => l.trim() !== "");

/** The sections compared, in print order, each as a function content → lines of text. */
const theorySections = [
  ["objectives", "Course learning objectives", (c) => nonEmpty(c.objectives).map((t, i) => `${i + 1}. ${t}`)],
  ["prerequisites", "Pre-requisites", (c) => nonEmpty(String(c.prerequisites ?? "").split(/\r?\n/))],
  [
    "units",
    "Units",
    (c) =>
      c.units.flatMap((u, i) => [
        `Unit ${i + 1}: ${u.title || "(no title)"} · ${hoursOf(u.hours)}`,
        ...nonEmpty(String(u.content ?? "").split(/\r?\n/)).map((l) => `  ${l}`),
      ]),
  ],
  ["flipped", "Flipped classroom", (c) => c.flippedSessions.map((s, i) => `Unit ${i + 1}: ${s ?? "–"} session(s)`)],
  [
    "experiments",
    "Experiments",
    (c) => [
      ...(c.experiments ?? []).map((e, i) => `Experiment ${i + 1}: ${e.title || "(no title)"} · ${hoursOf(e.hours)}`),
      ...(c.openEnded ?? []).map((e, i) => `Open-ended ${i + 1}: ${e.title || "(no title)"} · ${hoursOf(e.hours)}`),
    ],
  ],
  [
    "books",
    "Books and e-resources",
    (c) => [
      ...nonEmpty(c.textBooks.map(bookLine)).map((l, i) => `Text book ${i + 1}: ${l}`),
      ...nonEmpty((c.referenceBooks ?? []).map(bookLine)).map((l, i) => `Reference book ${i + 1}: ${l}`),
      ...c.eResources.filter((e) => e.title || e.url).map((e, i) => `E-resource ${i + 1}: ${e.title} ${e.url}`.trim()),
    ],
  ],
  [
    "twsl",
    "Term work and self-learning",
    (c) => [
      ...c.termWork.filter((a) => a.activity || a.hours !== null).map((a) => `TW: ${a.activity} · ${hoursOf(a.hours)}`),
      ...c.selfLearning
        .filter((a) => a.activity || a.hours !== null)
        .map((a) => `SL: ${a.activity} · ${hoursOf(a.hours)}`),
    ],
  ],
  [
    "outcomes",
    "Course outcomes",
    (c) => c.outcomes.map((o, i) => `CO${i + 1}: ${o.statement} [${o.verb || "no verb"}, level ${o.level ?? "–"}]`),
  ],
  [
    "mapping",
    "CO–PO/PSO mapping",
    (c) =>
      c.outcomes.map((o, i) => {
        const psos = Object.entries(o.psos ?? {})
          .filter(([, list]) => list.length)
          .map(([programme, list]) => `${programme}: ${list.join(", ")}`);
        const parts = [
          o.pos.length ? `PO ${o.pos.join(", ")}` : "no PO",
          ...psos.map((p) => `PSO ${p}`),
          o.wks.length ? `WK ${o.wks.join(", ")}` : null,
          o.sdgs.length ? `SDG ${o.sdgs.join(", ")}` : null,
        ].filter(Boolean);
        return `CO${i + 1}: ${parts.join(" · ")}`;
      }),
  ],
];

/**
 * Line-by-line difference (longest common subsequence).
 * @returns {{ type: "same" | "added" | "removed", text: string }[]}
 */
export function diffLines(before, after) {
  const n = before.length;
  const m = after.length;
  const lcs = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--)
    for (let j = m - 1; j >= 0; j--)
      lcs[i][j] = before[i] === after[j] ? lcs[i + 1][j + 1] + 1 : Math.max(lcs[i + 1][j], lcs[i][j + 1]);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (before[i] === after[j]) {
      out.push({ type: "same", text: before[i] });
      i++;
      j++;
    } else if (lcs[i + 1][j] >= lcs[i][j + 1]) out.push({ type: "removed", text: before[i++] });
    else out.push({ type: "added", text: after[j++] });
  }
  while (i < n) out.push({ type: "removed", text: before[i++] });
  while (j < m) out.push({ type: "added", text: after[j++] });
  return out;
}

/**
 * Compares two Theory contents section by section.
 * @returns {{ section: string, label: string, changed: boolean, lines: ReturnType<typeof diffLines> }[]}
 */
export function compareSyllabi(before, after) {
  return theorySections.map(([section, label, toLines]) => {
    const lines = diffLines(toLines(before), toLines(after));
    return { section, label, changed: lines.some((l) => l.type !== "same"), lines };
  });
}
