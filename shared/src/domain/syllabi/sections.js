// Section layout of a printed syllabus (README §5, §8): Dean Academics sets, per format, the order of the
// sections, turns the optional ones off, and renames headings, without a developer. Stored in
// FormatConfig.sections as [{ id, enabled, label }]; anything missing falls back to the defaults below.
//
// The institution header, title and course details always come first and the signature block last; the
// sections in between are listed here in the order of the 2025 Word templates.

/**
 * @typedef {{ id: string, name: string, label: string|null, canHide: boolean }} SectionDefinition
 * name: what the Dean sees; label: the printed heading (null = not renamable here, e.g. text-block titles).
 */
/** @type {SectionDefinition[]} */
export const syllabusSections = [
  { id: "objectives", name: "Course learning objectives", label: "Course learning objectives", canHide: false },
  { id: "prerequisites", name: "Pre-requisites", label: null, canHide: false }, // heading: format.prerequisiteLabel
  { id: "units", name: "Units", label: null, canHide: false },
  { id: "flipped", name: "Flipped classroom", label: "Flipped Classroom Details", canHide: true },
  { id: "experiments", name: "Experiments / practical component", label: null, canHide: false }, // heading by format
  { id: "books", name: "Books and e-resources", label: "Books", canHide: false },
  { id: "methods", name: "Delivery and assessment methods", label: null, canHide: true }, // text-block titles
  { id: "activities", name: "Suggested learning activities", label: null, canHide: true },
  {
    id: "twsl",
    name: "Term work and self-learning",
    label: "Term Work (TW) and Self Learning (SL) components in Number of hours per semester",
    canHide: false,
  },
  { id: "outcomes", name: "Course outcomes", label: "Course Outcome (COs)", canHide: false },
  { id: "standard", name: "CIE, SEE and rubrics", label: null, canHide: true }, // text-block titles
  { id: "mapping", name: "CO–PO/PSO mapping", label: "CO-PO Mapping (Planned)", canHide: false },
];

export const sectionIds = syllabusSections.map((s) => s.id);
const byId = new Map(syllabusSections.map((s) => [s.id, s]));

/**
 * The format's sections in print order, with what is on and the heading to print.
 * @param {{ sections?: { id: string, enabled?: boolean, label?: string|null }[] | null }} format
 * @returns {{ id: string, name: string, enabled: boolean, label: string|null, defaultLabel: string|null, canHide: boolean }[]}
 */
export function resolveSections(format) {
  const stored = Array.isArray(format?.sections) ? format.sections.filter((s) => byId.has(s?.id)) : [];
  const seen = new Set();
  const ordered = [];
  for (const s of stored) {
    if (seen.has(s.id)) continue;
    seen.add(s.id);
    ordered.push(s);
  }
  // A section the stored list does not mention (e.g. one added in a later version) goes right after the section
  // that precedes it in the template order, or first when it has none.
  syllabusSections.forEach((def, i) => {
    if (seen.has(def.id)) return;
    const predecessor = i === 0 ? -1 : ordered.findIndex((s) => s.id === syllabusSections[i - 1].id);
    ordered.splice(predecessor + 1, 0, { id: def.id });
    seen.add(def.id);
  });
  return ordered.map((s) => {
    const def = byId.get(s.id);
    const custom = typeof s.label === "string" ? s.label.trim() : "";
    return {
      id: def.id,
      name: def.name,
      enabled: def.canHide ? s.enabled !== false : true,
      label: def.label === null ? null : custom || def.label,
      defaultLabel: def.label,
      canHide: def.canHide,
    };
  });
}

/** Whether a section prints (and is shown in the editor) for this format. */
export function sectionEnabled(format, id) {
  return resolveSections(format).find((s) => s.id === id)?.enabled ?? true;
}

/** The printed heading of a section (the Dean's label, else the default). */
export function sectionLabel(format, id) {
  return resolveSections(format).find((s) => s.id === id)?.label ?? byId.get(id)?.label ?? null;
}
