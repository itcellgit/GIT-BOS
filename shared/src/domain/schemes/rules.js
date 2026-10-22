// Scheme rules: checks a course row in a scheme against the Layer 1 configuration.
// Pure functions only (no database, no framework) so they can be unit-tested. README §9.
export const formatLabels = {
  THEORY: "Theory",
  INTEGRATED: "Integrated",
  INTEGRATED_PROJECT: "Integrated (project-based)",
  LAB: "Lab / AEC",
};
export function formatCredits(c) {
  return `${c.lCredits}:${c.tCredits}:${c.pCredits}`;
}
export function totalCredits(c) {
  return c.lCredits + c.tCredits + c.pCredits;
}
/** Total student-effort hours per semester = credits × hours per credit. */
export function totalHours(course, scheme) {
  return totalCredits(course) * scheme.hoursPerCredit;
}
/** Semester contact hours and the TW & SL remainder implied by a credit pattern. */
export function expectedHours(pattern, scheme) {
  const lHours = pattern.lHours * scheme.teachingWeeks;
  const tHours = pattern.tHours * scheme.teachingWeeks;
  const pHours = pattern.pHours * scheme.teachingWeeks;
  const total = (pattern.lCredits + pattern.tCredits + pattern.pCredits) * scheme.hoursPerCredit;
  return { lHours, tHours, pHours, twSlHours: total - (lHours + tHours + pHours), total };
}
function findPattern(course, category) {
  return category.creditPatterns.find(
    (p) => p.lCredits === course.lCredits && p.tCredits === course.tCredits && p.pCredits === course.pCredits,
  );
}
/**
 * Validates one scheme-course row. Returns an empty list when the row is consistent
 * with its category and the scheme rules.
 */
export function validateSchemeCourse(course, category, scheme) {
  const issues = [];
  const error = (field, message) => issues.push({ field, severity: "error", message });
  for (const key of ["lCredits", "tCredits", "pCredits", "lHours", "tHours", "pHours", "twSlHours", "cieMarks"]) {
    if (!Number.isInteger(course[key]) || course[key] < 0) {
      error(key, `${key} must be a whole number of 0 or more.`);
    }
  }
  if (issues.length > 0) return issues;
  // Marks
  if (course.cieMarks !== category.cieMarks) {
    error("cieMarks", `CIE marks should be ${category.cieMarks} for ${category.code} (found ${course.cieMarks}).`);
  }
  if (!category.hasSee) {
    if (course.seeMarks !== null && course.seeMarks !== 0) {
      error("seeMarks", `${category.code} has no SEE, so SEE marks must be empty.`);
    }
  } else if (course.seeMarks !== category.seeMarks) {
    error(
      "seeMarks",
      `SEE marks should be ${category.seeMarks} for ${category.code} (found ${course.seeMarks ?? "none"}).`,
    );
  }
  // Format
  if (category.syllabusRequired) {
    if (!course.format) {
      error("format", `Choose a syllabus format (${category.allowedFormats.map((f) => formatLabels[f]).join(" / ")}).`);
    } else if (!category.allowedFormats.includes(course.format)) {
      error(
        "format",
        `${formatLabels[course.format]} format is not allowed for ${category.code}. Allowed: ${category.allowedFormats
          .map((f) => formatLabels[f])
          .join(", ")}.`,
      );
    }
  }
  // Pass/fail (PP) courses carry no credits; the credit-hour rule does not apply.
  if (category.passFail) {
    if (totalCredits(course) !== 0) {
      error("credits", `${category.code} is graded pass/fail (PP), so credits must be 0:0:0.`);
    }
    return issues;
  }
  const pattern = findPattern(course, category);
  if (!pattern) {
    const allowed = category.creditPatterns.map(formatCredits).join(", ") || "none configured";
    error("credits", `Credits ${formatCredits(course)} are not allowed for ${category.code}. Allowed: ${allowed}.`);
    return issues;
  }
  const expected = expectedHours(pattern, scheme);
  const weeks = scheme.teachingWeeks;
  const checkHours = (field, perWeek, label) => {
    if (course[field] !== expected[field]) {
      error(
        field,
        `${label} hours should be ${expected[field]} (${perWeek} h/week × ${weeks} weeks), found ${course[field]}.`,
      );
    }
  };
  checkHours("lHours", pattern.lHours, "Lecture");
  checkHours("tHours", pattern.tHours, "Tutorial");
  checkHours("pHours", pattern.pHours, "Practical");
  if (course.twSlHours !== expected.twSlHours) {
    error(
      "twSlHours",
      `TW & SL hours should be ${expected.twSlHours} (${totalCredits(course)} credits × ${scheme.hoursPerCredit} h = ${expected.total} h, minus ${expected.lHours + expected.tHours + expected.pHours} contact hours), found ${course.twSlHours}.`,
    );
  }
  return issues;
}
/** Fills hours from a credit pattern — used to pre-fill forms. */
export function suggestFigures(pattern, category, scheme) {
  const e = expectedHours(pattern, scheme);
  return {
    lCredits: pattern.lCredits,
    tCredits: pattern.tCredits,
    pCredits: pattern.pCredits,
    lHours: e.lHours,
    tHours: e.tHours,
    pHours: e.pHours,
    twSlHours: e.twSlHours,
    cieMarks: category.cieMarks,
    seeMarks: category.hasSee ? category.seeMarks : null,
  };
}
