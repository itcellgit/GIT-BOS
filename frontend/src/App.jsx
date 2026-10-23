import { Route, Routes } from "react-router";
import { PortalLayout } from "@/components/layout/portal-layout";
import { RequireAuth } from "@/components/layout/require-auth";
import { AccountPage } from "@/pages/account-page";
import { AdminDepartmentsPage } from "@/pages/admin-departments-page";
import { AdminUsersPage } from "@/pages/admin-users-page";
import { ApprovedSyllabiPage } from "@/pages/approved-syllabi-page";
import { CourseListPage } from "@/pages/course-list-page";
import { DashboardPage } from "@/pages/dashboard-page";
import { ExpertReviewPage } from "@/pages/expert-review-page";
import { DepartmentPage } from "@/pages/department-page";
import { HomePage } from "@/pages/home-page";
import { LoginPage } from "@/pages/login-page";
import { NoAccessPage, NotFoundPage } from "@/pages/no-access-page";
import { SchemePage } from "@/pages/scheme-page";
import { SchemesPage } from "@/pages/schemes-page";
import { SyllabusPage } from "@/pages/syllabus-page";
import { SyllabusPreviewPage } from "@/pages/syllabus-preview-page";
import { SyllabusReviewPage } from "@/pages/syllabus-review-page";

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      {/* Public: an expert opens it from their review link (no sign-in). */}
      <Route path="/expert/:token" element={<ExpertReviewPage />} />

      {/* Reachable while a password change is required. */}
      <Route element={<RequireAuth allowPasswordChange />}>
        <Route path="/account" element={<AccountPage />} />
      </Route>

      <Route element={<RequireAuth />}>
        <Route element={<PortalLayout />}>
          <Route index element={<HomePage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="approved-syllabi" element={<ApprovedSyllabiPage />} />
          <Route path="schemes" element={<SchemesPage />} />
          <Route path="schemes/:schemeId" element={<SchemePage />} />
          <Route path="schemes/:schemeId/programmes/:programmeId" element={<CourseListPage />} />
          <Route path="syllabi/:schemeId/:courseId" element={<SyllabusPage />} />
          <Route path="syllabi/:schemeId/:courseId/preview" element={<SyllabusPreviewPage />} />
          <Route path="syllabi/:schemeId/:courseId/review" element={<SyllabusReviewPage />} />
          <Route path="departments/:code" element={<DepartmentPage />} />
          <Route path="admin/users" element={<AdminUsersPage />} />
          <Route path="admin/departments" element={<AdminDepartmentsPage />} />
          <Route path="no-access" element={<NoAccessPage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Route>
    </Routes>
  );
}
