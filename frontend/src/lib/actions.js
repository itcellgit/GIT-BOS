// Every change the UI can make, as one function per action. Each calls the Express API and
// resolves to the API result { ok, data?, message?, error?, fieldErrors? } (never throws).
// Forms use them as `action={saveCategory.bind(null, schemeId, categoryId)}`.
import { api } from "@/lib/api";

const save = (base, id, values) => (id ? api.put(`${base}/${id}`, values) : api.post(base, values));

// --- Administration ---------------------------------------------------------------
export const saveDepartment = (id, values) => save("/admin/departments", id, values);
export const saveProgramme = (id, values) => save("/admin/programmes", id, values);
export const saveUser = (id, values) => save("/admin/users", id, values);
export const addRole = (userId, values) => api.post(`/admin/users/${userId}/roles`, values);
export const removeRole = (roleId) => api.delete(`/admin/roles/${roleId}`);
export const setInitialPassword = (userId, values) => api.post(`/admin/users/${userId}/password`, values);

// --- Schemes (Layer 1) --------------------------------------------------------------
export const createScheme = (values) => api.post("/schemes", values);
export const updateScheme = (schemeId, values) => api.put(`/schemes/${schemeId}`, values);
export const publishScheme = (schemeId) => api.post(`/schemes/${schemeId}/publish`);
export const retireScheme = (schemeId) => api.post(`/schemes/${schemeId}/retire`);
export const deleteDraftScheme = (schemeId) => api.delete(`/schemes/${schemeId}`);

export const saveCategory = (schemeId, categoryId, values) =>
  save(`/schemes/${schemeId}/categories`, categoryId, values);
export const deleteCategory = (schemeId, categoryId) => api.delete(`/schemes/${schemeId}/categories/${categoryId}`);
export const addCreditPattern = (schemeId, categoryId, values) =>
  api.post(`/schemes/${schemeId}/categories/${categoryId}/patterns`, values);
export const deleteCreditPattern = (schemeId, patternId) => api.delete(`/schemes/${schemeId}/patterns/${patternId}`);
export const saveFormatConfig = (schemeId, formatId, values) =>
  api.put(`/schemes/${schemeId}/formats/${formatId}`, values);
export const saveOutcomeItem = (schemeId, itemId, values) => save(`/schemes/${schemeId}/outcomes`, itemId, values);
export const deleteOutcomeItem = (schemeId, itemId) => api.delete(`/schemes/${schemeId}/outcomes/${itemId}`);
export const saveBloomLevel = (schemeId, levelId, values) => api.put(`/schemes/${schemeId}/bloom/${levelId}`, values);
export const saveTextBlock = (schemeId, blockId, values) => save(`/schemes/${schemeId}/text-blocks`, blockId, values);
export const deleteTextBlock = (schemeId, blockId) => api.delete(`/schemes/${schemeId}/text-blocks/${blockId}`);

// --- Course lists (Layer 2) -----------------------------------------------------------
const list = (schemeId, programmeId) => `/schemes/${schemeId}/programmes/${programmeId}`;
export const saveSchemeCourse = (schemeId, programmeId, rowId, values) =>
  save(`${list(schemeId, programmeId)}/courses`, rowId, values);
export const deleteSchemeCourse = (schemeId, programmeId, rowId) =>
  api.delete(`${list(schemeId, programmeId)}/courses/${rowId}`);
export const saveElectiveGroup = (schemeId, programmeId, groupId, values) =>
  save(`${list(schemeId, programmeId)}/elective-groups`, groupId, values);
export const deleteElectiveGroup = (schemeId, programmeId, groupId) =>
  api.delete(`${list(schemeId, programmeId)}/elective-groups/${groupId}`);
export const savePso = (schemeId, programmeId, psoId, values) =>
  save(`${list(schemeId, programmeId)}/psos`, psoId, values);
export const deletePso = (schemeId, programmeId, psoId) => api.delete(`${list(schemeId, programmeId)}/psos/${psoId}`);
export const importCourses = (schemeId, programmeId, formData) =>
  api.post(`${list(schemeId, programmeId)}/import`, formData);
export const workbookUrl = (schemeId, programmeId) => `/api${list(schemeId, programmeId)}/workbook`;

// --- Departments ------------------------------------------------------------------------
export const saveReviewer = (departmentCode, reviewerId, values) =>
  save(`/departments/${departmentCode}/reviewers`, reviewerId, values);
export const addAssignment = (departmentCode, schemeId, courseId, values) =>
  api.post(`/departments/${departmentCode}/schemes/${schemeId}/courses/${courseId}/assignments`, values);
export const removeAssignment = (departmentCode, assignmentId) =>
  api.delete(`/departments/${departmentCode}/assignments/${assignmentId}`);
