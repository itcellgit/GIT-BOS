-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'DEAN_ACADEMICS', 'BOS_COORDINATOR', 'HOD', 'FACULTY');

-- CreateEnum
CREATE TYPE "SchemeStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'RETIRED');

-- CreateEnum
CREATE TYPE "SyllabusFormat" AS ENUM ('THEORY', 'INTEGRATED', 'INTEGRATED_PROJECT', 'LAB');

-- CreateEnum
CREATE TYPE "TextBlockKind" AS ENUM ('DELIVERY_METHODS', 'ASSESSMENT_METHODS', 'LEARNING_ACTIVITIES', 'CIE_SCHEME', 'SEE_SCHEME', 'RUBRICS');

-- CreateEnum
CREATE TYPE "OutcomeKind" AS ENUM ('PO', 'PSO', 'WK', 'SDG');

-- CreateEnum
CREATE TYPE "AssignmentRole" AS ENUM ('COORDINATOR', 'CO_AUTHOR');

-- CreateEnum
CREATE TYPE "ReviewerCategory" AS ENUM ('INTERNAL_BOS', 'EXTERNAL_BOS', 'INDUSTRY_EXPERT', 'ALUMNUS', 'ACADEMIC_COUNCIL');

-- CreateTable
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "designation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_assignment" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "departmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "institution_settings" (
    "id" INTEGER NOT NULL DEFAULT 1,
    "name" TEXT NOT NULL,
    "shortName" TEXT,
    "address" TEXT,
    "estd" TEXT,
    "logoPath" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "institution_settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "department" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "programme" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'UG',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "framework" TEXT,
    "effectiveFrom" TEXT,
    "status" "SchemeStatus" NOT NULL DEFAULT 'DRAFT',
    "teachingWeeks" INTEGER NOT NULL DEFAULT 14,
    "hoursPerCredit" INTEGER NOT NULL DEFAULT 30,
    "clonedFromId" TEXT,
    "publishedAt" TIMESTAMP(3),
    "retiredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_category" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "syllabusRequired" BOOLEAN NOT NULL DEFAULT true,
    "passFail" BOOLEAN NOT NULL DEFAULT false,
    "hasSee" BOOLEAN NOT NULL DEFAULT true,
    "cieMarks" INTEGER NOT NULL DEFAULT 100,
    "seeMarks" INTEGER DEFAULT 100,
    "allowedFormats" "SyllabusFormat"[],
    "defaultFormat" "SyllabusFormat",
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "course_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_pattern" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "lCredits" INTEGER NOT NULL,
    "tCredits" INTEGER NOT NULL,
    "pCredits" INTEGER NOT NULL,
    "lHours" INTEGER NOT NULL,
    "tHours" INTEGER NOT NULL,
    "pHours" INTEGER NOT NULL,

    CONSTRAINT "credit_pattern_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "format_config" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "format" "SyllabusFormat" NOT NULL,
    "title" TEXT NOT NULL,
    "unitCount" INTEGER NOT NULL DEFAULT 5,
    "experimentCount" INTEGER NOT NULL DEFAULT 0,
    "openEndedCount" INTEGER NOT NULL DEFAULT 0,
    "cloMin" INTEGER NOT NULL DEFAULT 4,
    "cloMax" INTEGER NOT NULL DEFAULT 6,
    "coMin" INTEGER NOT NULL DEFAULT 4,
    "coMax" INTEGER NOT NULL DEFAULT 6,
    "hasReferenceBooks" BOOLEAN NOT NULL DEFAULT true,
    "prerequisiteLabel" TEXT NOT NULL DEFAULT 'Pre-requisites',
    "sections" JSONB,
    "layoutVersion" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "format_config_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "text_block" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "kind" "TextBlockKind" NOT NULL,
    "format" "SyllabusFormat",
    "yearOfStudy" INTEGER,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "text_block_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "outcome_item" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "kind" "OutcomeKind" NOT NULL,
    "programmeId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "outcome_item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "bloom_level" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "shortCode" TEXT NOT NULL,
    "verbs" TEXT[],

    CONSTRAINT "bloom_level_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "owningDepartmentId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elective_group" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,

    CONSTRAINT "elective_group_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_course" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "courseId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "format" "SyllabusFormat",
    "teachingDepartmentId" TEXT NOT NULL,
    "lCredits" INTEGER NOT NULL DEFAULT 0,
    "tCredits" INTEGER NOT NULL DEFAULT 0,
    "pCredits" INTEGER NOT NULL DEFAULT 0,
    "lHours" INTEGER NOT NULL DEFAULT 0,
    "tHours" INTEGER NOT NULL DEFAULT 0,
    "pHours" INTEGER NOT NULL DEFAULT 0,
    "twSlHours" INTEGER NOT NULL DEFAULT 0,
    "cieMarks" INTEGER NOT NULL DEFAULT 100,
    "seeMarks" INTEGER,
    "examHours" INTEGER,
    "electiveGroupId" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "scheme_course_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_assignment" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "role" "AssignmentRole" NOT NULL DEFAULT 'COORDINATOR',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "course_assignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reviewer" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" "ReviewerCategory" NOT NULL,
    "designation" TEXT,
    "organisation" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reviewer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_log" (
    "id" TEXT NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "departmentId" TEXT,
    "details" JSONB,

    CONSTRAINT "audit_log_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");

-- CreateIndex
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");

-- CreateIndex
CREATE INDEX "session_userId_idx" ON "session"("userId");

-- CreateIndex
CREATE INDEX "account_userId_idx" ON "account"("userId");

-- CreateIndex
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");

-- CreateIndex
CREATE INDEX "role_assignment_departmentId_idx" ON "role_assignment"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "role_assignment_userId_role_departmentId_key" ON "role_assignment"("userId", "role", "departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "department_code_key" ON "department"("code");

-- CreateIndex
CREATE UNIQUE INDEX "programme_code_key" ON "programme"("code");

-- CreateIndex
CREATE INDEX "programme_departmentId_idx" ON "programme"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_code_key" ON "scheme"("code");

-- CreateIndex
CREATE UNIQUE INDEX "course_category_schemeId_code_key" ON "course_category"("schemeId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "credit_pattern_categoryId_lCredits_tCredits_pCredits_lHours_key" ON "credit_pattern"("categoryId", "lCredits", "tCredits", "pCredits", "lHours", "tHours", "pHours");

-- CreateIndex
CREATE UNIQUE INDEX "format_config_schemeId_format_key" ON "format_config"("schemeId", "format");

-- CreateIndex
CREATE INDEX "text_block_schemeId_kind_idx" ON "text_block"("schemeId", "kind");

-- CreateIndex
CREATE INDEX "outcome_item_schemeId_kind_idx" ON "outcome_item"("schemeId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "bloom_level_schemeId_level_key" ON "bloom_level"("schemeId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "course_code_key" ON "course"("code");

-- CreateIndex
CREATE INDEX "course_owningDepartmentId_idx" ON "course"("owningDepartmentId");

-- CreateIndex
CREATE UNIQUE INDEX "elective_group_schemeId_programmeId_code_key" ON "elective_group"("schemeId", "programmeId", "code");

-- CreateIndex
CREATE INDEX "scheme_course_schemeId_programmeId_semester_idx" ON "scheme_course"("schemeId", "programmeId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "scheme_course_schemeId_programmeId_courseId_key" ON "scheme_course"("schemeId", "programmeId", "courseId");

-- CreateIndex
CREATE INDEX "course_assignment_userId_idx" ON "course_assignment"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "course_assignment_schemeId_courseId_userId_key" ON "course_assignment"("schemeId", "courseId", "userId");

-- CreateIndex
CREATE INDEX "reviewer_departmentId_idx" ON "reviewer"("departmentId");

-- CreateIndex
CREATE INDEX "audit_log_entityType_entityId_idx" ON "audit_log"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_log_at_idx" ON "audit_log"("at");

-- AddForeignKey
ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_assignment" ADD CONSTRAINT "role_assignment_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "programme" ADD CONSTRAINT "programme_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme" ADD CONSTRAINT "scheme_clonedFromId_fkey" FOREIGN KEY ("clonedFromId") REFERENCES "scheme"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_category" ADD CONSTRAINT "course_category_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_pattern" ADD CONSTRAINT "credit_pattern_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "course_category"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "format_config" ADD CONSTRAINT "format_config_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "text_block" ADD CONSTRAINT "text_block_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_item" ADD CONSTRAINT "outcome_item_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "outcome_item" ADD CONSTRAINT "outcome_item_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "bloom_level" ADD CONSTRAINT "bloom_level_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course" ADD CONSTRAINT "course_owningDepartmentId_fkey" FOREIGN KEY ("owningDepartmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elective_group" ADD CONSTRAINT "elective_group_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "elective_group" ADD CONSTRAINT "elective_group_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_course" ADD CONSTRAINT "scheme_course_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_course" ADD CONSTRAINT "scheme_course_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "programme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_course" ADD CONSTRAINT "scheme_course_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_course" ADD CONSTRAINT "scheme_course_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "course_category"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_course" ADD CONSTRAINT "scheme_course_teachingDepartmentId_fkey" FOREIGN KEY ("teachingDepartmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_course" ADD CONSTRAINT "scheme_course_electiveGroupId_fkey" FOREIGN KEY ("electiveGroupId") REFERENCES "elective_group"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_assignment" ADD CONSTRAINT "course_assignment_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_assignment" ADD CONSTRAINT "course_assignment_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_assignment" ADD CONSTRAINT "course_assignment_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reviewer" ADD CONSTRAINT "reviewer_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
