import { describe, expect, it } from "vitest";
import { can, departmentsWithRole } from "./permissions.js";
const actor = (...roles) => ({ id: "u1", isActive: true, roles });
const CSE = "dept-cse";
const MECH = "dept-mech";
describe("can()", () => {
  it("denies everything to a missing or inactive user", () => {
    expect(can(null, "scheme.view")).toBe(false);
    expect(can({ ...actor({ role: "ADMIN", departmentId: null }), isActive: false }, "users.manage")).toBe(false);
  });
  it("lets only Admin manage users and departments", () => {
    expect(can(actor({ role: "ADMIN", departmentId: null }), "users.manage")).toBe(true);
    expect(can(actor({ role: "DEAN_ACADEMICS", departmentId: null }), "users.manage")).toBe(false);
    expect(can(actor({ role: "BOS_COORDINATOR", departmentId: CSE }), "departments.manage")).toBe(false);
  });
  it("lets only Dean Academics configure schemes (Layer 1)", () => {
    expect(can(actor({ role: "DEAN_ACADEMICS", departmentId: null }), "scheme.configure")).toBe(true);
    expect(can(actor({ role: "ADMIN", departmentId: null }), "scheme.configure")).toBe(false);
    expect(can(actor({ role: "BOS_COORDINATOR", departmentId: CSE }), "scheme.configure")).toBe(false);
  });
  it("scopes Layer 2 configuration to the BoS Coordinator's own department", () => {
    const bos = actor({ role: "BOS_COORDINATOR", departmentId: CSE });
    expect(can(bos, "department.configure", { departmentId: CSE })).toBe(true);
    expect(can(bos, "department.configure", { departmentId: MECH })).toBe(false);
    expect(can(bos, "department.configure")).toBe(false);
  });
  it("does not let HoD or faculty configure a department", () => {
    expect(can(actor({ role: "HOD", departmentId: CSE }), "department.configure", { departmentId: CSE })).toBe(false);
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "department.configure", { departmentId: CSE })).toBe(
      false,
    );
  });
  it("lets everyone with a role read approved syllabi of any department", () => {
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "syllabus.viewApproved", { departmentId: MECH })).toBe(
      true,
    );
    expect(can(actor({ role: "HOD", departmentId: MECH }), "syllabus.viewApproved", { departmentId: CSE })).toBe(true);
    expect(can(actor(), "syllabus.viewApproved", { departmentId: CSE })).toBe(false);
    // …but not the working copy of another department's syllabus.
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "syllabus.view", { departmentId: MECH })).toBe(false);
  });
  it("gives department view to its BoS Coordinator and HoD, and to Dean and Admin everywhere", () => {
    expect(can(actor({ role: "HOD", departmentId: CSE }), "department.view", { departmentId: CSE })).toBe(true);
    expect(can(actor({ role: "HOD", departmentId: CSE }), "department.view", { departmentId: MECH })).toBe(false);
    expect(can(actor({ role: "DEAN_ACADEMICS", departmentId: null }), "department.view", { departmentId: MECH })).toBe(
      true,
    );
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "department.view", { departmentId: CSE })).toBe(false);
  });
  it("supports users holding several roles", () => {
    const both = actor({ role: "FACULTY", departmentId: CSE }, { role: "BOS_COORDINATOR", departmentId: CSE });
    expect(can(both, "department.configure", { departmentId: CSE })).toBe(true);
  });
});
describe("syllabi", () => {
  const own = { departmentId: CSE, isAssigned: true };
  const cseCourse = { departmentId: CSE, isAssigned: false };
  it("lets the assigned faculty and the owning department's BoS Coordinator edit", () => {
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "syllabus.edit", own)).toBe(true);
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "syllabus.edit", cseCourse)).toBe(false);
    expect(can(actor({ role: "BOS_COORDINATOR", departmentId: CSE }), "syllabus.edit", cseCourse)).toBe(true);
    expect(can(actor({ role: "BOS_COORDINATOR", departmentId: MECH }), "syllabus.edit", cseCourse)).toBe(false);
  });
  it("lets only the owning department's BoS Coordinator run the review (inputs, stages, unlock)", () => {
    expect(can(actor({ role: "BOS_COORDINATOR", departmentId: CSE }), "syllabus.review", cseCourse)).toBe(true);
    expect(can(actor({ role: "BOS_COORDINATOR", departmentId: MECH }), "syllabus.review", cseCourse)).toBe(false);
    expect(can(actor({ role: "FACULTY", departmentId: CSE }), "syllabus.review", own)).toBe(false);
    expect(can(actor({ role: "HOD", departmentId: CSE }), "syllabus.review", cseCourse)).toBe(false);
    expect(can(actor({ role: "DEAN_ACADEMICS", departmentId: null }), "syllabus.review", cseCourse)).toBe(false);
  });
  it("gives read-only access to the HoD and Dean Academics, and none to the Administrator", () => {
    for (const reader of [
      actor({ role: "HOD", departmentId: CSE }),
      actor({ role: "DEAN_ACADEMICS", departmentId: null }),
    ]) {
      expect(can(reader, "syllabus.view", cseCourse)).toBe(true);
      expect(can(reader, "syllabus.edit", cseCourse)).toBe(false);
    }
    expect(can(actor({ role: "HOD", departmentId: MECH }), "syllabus.view", cseCourse)).toBe(false);
    expect(can(actor({ role: "ADMIN", departmentId: null }), "syllabus.view", cseCourse)).toBe(false);
  });
});
describe("departmentsWithRole()", () => {
  it("lists distinct departments for the given roles", () => {
    const a = actor(
      { role: "BOS_COORDINATOR", departmentId: CSE },
      { role: "HOD", departmentId: CSE },
      { role: "HOD", departmentId: MECH },
      { role: "ADMIN", departmentId: null },
    );
    expect(departmentsWithRole(a, ["BOS_COORDINATOR", "HOD"]).sort()).toEqual([CSE, MECH].sort());
  });
});
describe("Super Admin", () => {
  const superAdmin = actor({ role: "SUPER_ADMIN", departmentId: null });
  it("can do everything, in every department", () => {
    for (const action of ["users.manage", "departments.manage", "scheme.configure", "scheme.view"]) {
      expect(can(superAdmin, action)).toBe(true);
    }
    expect(can(superAdmin, "department.configure", { departmentId: MECH })).toBe(true);
    expect(can(superAdmin, "department.view", { departmentId: CSE })).toBe(true);
  });
  it("is the only role that manages Super Admins", () => {
    expect(can(superAdmin, "superAdmins.manage")).toBe(true);
    expect(can(actor({ role: "ADMIN", departmentId: null }), "superAdmins.manage")).toBe(false);
    expect(can(actor({ role: "DEAN_ACADEMICS", departmentId: null }), "superAdmins.manage")).toBe(false);
  });
  it("loses everything when deactivated", () => {
    expect(can({ ...superAdmin, isActive: false }, "scheme.view")).toBe(false);
  });
});
