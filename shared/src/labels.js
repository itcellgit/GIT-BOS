// Display labels for enum values (safe to use in client and server code).
export const schemeStatusLabels = { DRAFT: "Draft", PUBLISHED: "Published", RETIRED: "Retired" };
export const textBlockKindLabels = {
  DELIVERY_METHODS: "Course delivery methods",
  ASSESSMENT_METHODS: "Assessment methods",
  LEARNING_ACTIVITIES: "Suggested learning activities",
  CIE_SCHEME: "Scheme of CIE",
  SEE_SCHEME: "Scheme of SEE",
  RUBRICS: "Rubrics",
};
export const outcomeKindLabels = {
  PO: "Programme Outcomes (PO)",
  PSO: "Programme Specific Outcomes (PSO)",
  WK: "Knowledge and attitude profile (WK)",
  SDG: "Sustainable Development Goals (SDG)",
};
export const reviewerCategoryLabels = {
  INTERNAL_BOS: "Internal BOS member",
  EXTERNAL_BOS: "External BOS member",
  INDUSTRY_EXPERT: "Industry expert",
  ALUMNUS: "Alumnus",
  ACADEMIC_COUNCIL: "Academic Council member",
};
export const assignmentRoleLabels = { COORDINATOR: "Course Coordinator", CO_AUTHOR: "Co-author" };
export function toOptions(labels) {
  return Object.keys(labels).map((value) => ({ value, label: labels[value] }));
}
