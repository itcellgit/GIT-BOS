// Permissions: the single place that decides who may do what (README §4).
// Every Server Action and route calls `can()` (via `requirePermission`) on the server.
export const roleLabels = {
  SUPER_ADMIN: "Super Admin",
  ADMIN: "Administrator",
  DEAN_ACADEMICS: "Dean Academics",
  BOS_COORDINATOR: "BoS Coordinator",
  HOD: "Head of Department",
  FACULTY: "Faculty",
};
export const departmentScopedRoles = ["BOS_COORDINATOR", "HOD", "FACULTY"];
export const institutionRoles = ["SUPER_ADMIN", "ADMIN", "DEAN_ACADEMICS"];
export function hasRole(actor, role, departmentId) {
  return actor.roles.some((r) => r.role === role && (departmentId === undefined || r.departmentId === departmentId));
}
/** Department ids in which the actor holds any of the given roles. */
export function departmentsWithRole(actor, roles) {
  return [...new Set(actor.roles.filter((r) => roles.includes(r.role) && r.departmentId).map((r) => r.departmentId))];
}
export function can(actor, action, resource = {}) {
  if (!actor || !actor.isActive) return false;
  // Super Admin can do everything, everywhere (every action is still audit-logged).
  if (hasRole(actor, "SUPER_ADMIN")) return true;
  const isAdmin = hasRole(actor, "ADMIN");
  const isDean = hasRole(actor, "DEAN_ACADEMICS");
  const dept = resource.departmentId ?? null;
  switch (action) {
    case "superAdmins.manage":
      return false; // Super Admins only (handled above)
    case "users.manage":
    case "departments.manage":
    case "institution.manage":
      return isAdmin;
    case "scheme.configure":
      return isDean;
    case "scheme.view":
      return actor.roles.length > 0;
    case "department.configure":
      return dept !== null && hasRole(actor, "BOS_COORDINATOR", dept);
    case "department.view":
      if (isAdmin || isDean) return true;
      return dept !== null && (hasRole(actor, "BOS_COORDINATOR", dept) || hasRole(actor, "HOD", dept));
    // Syllabi: resource = { departmentId: owning department of the course, isAssigned: actor is its
    // Course Coordinator or a co-author in that scheme }.
    case "syllabus.edit": // also: submit, save a version, record the action taken on an input
      return !!resource.isAssigned || (dept !== null && hasRole(actor, "BOS_COORDINATOR", dept));
    // Phase 2 (README §4): record meeting inputs, close a stage, record approval, unlock (D3, D5).
    case "syllabus.review":
      return dept !== null && hasRole(actor, "BOS_COORDINATOR", dept);
    // The Academic Council-approved (frozen) copy of any syllabus: the institution's official
    // document, readable and downloadable by everyone who works in the portal.
    case "syllabus.viewApproved":
      return actor.roles.length > 0;
    case "syllabus.view":
      if (isDean || resource.isAssigned) return true;
      return dept !== null && (hasRole(actor, "BOS_COORDINATOR", dept) || hasRole(actor, "HOD", dept));
  }
}
