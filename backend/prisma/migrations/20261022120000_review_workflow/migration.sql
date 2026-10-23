-- CreateEnum
CREATE TYPE "ReviewStage" AS ENUM ('INTERNAL_BOS', 'EXPERT', 'EXTERNAL_BOS', 'ACADEMIC_COUNCIL');

-- CreateEnum
CREATE TYPE "VersionSource" AS ENUM ('SUBMIT', 'COMMIT', 'CLOSE_STAGE', 'APPROVE');

-- CreateEnum
CREATE TYPE "InputDecision" AS ENUM ('ACCEPTED', 'PARTLY', 'NOT_ACCEPTED');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "SyllabusStatus" ADD VALUE 'IN_REVIEW';
ALTER TYPE "SyllabusStatus" ADD VALUE 'APPROVED';
ALTER TYPE "SyllabusStatus" ADD VALUE 'REVISING';

-- AlterTable
ALTER TABLE "syllabus" ADD COLUMN     "committedRevision" INTEGER,
ADD COLUMN     "majorVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "minorVersion" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "officialVersionId" TEXT,
ADD COLUMN     "stage" "ReviewStage";

-- CreateTable
CREATE TABLE "syllabus_version" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "major" INTEGER NOT NULL,
    "minor" INTEGER NOT NULL,
    "label" TEXT NOT NULL,
    "stage" "ReviewStage",
    "source" "VersionSource" NOT NULL,
    "reason" TEXT,
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_meeting" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "title" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL,
    "venue" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_meeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_input" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL,
    "reviewedVersionId" TEXT NOT NULL,
    "meetingId" TEXT,
    "sectionRef" TEXT NOT NULL,
    "inputText" TEXT NOT NULL,
    "givenById" TEXT,
    "actionTaken" TEXT,
    "decision" "InputDecision",
    "respondedById" TEXT,
    "resultingVersionId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "review_input_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_unlock" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "stage" "ReviewStage" NOT NULL DEFAULT 'ACADEMIC_COUNCIL',
    "fromLabel" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_unlock_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_approval" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "approvedOn" DATE NOT NULL,
    "reference" TEXT NOT NULL,
    "recordedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_MeetingAttendees" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_MeetingAttendees_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_version_syllabusId_major_minor_key" ON "syllabus_version"("syllabusId", "major", "minor");

-- CreateIndex
CREATE INDEX "review_meeting_departmentId_schemeId_idx" ON "review_meeting"("departmentId", "schemeId");

-- CreateIndex
CREATE INDEX "review_input_syllabusId_stage_idx" ON "review_input"("syllabusId", "stage");

-- CreateIndex
CREATE INDEX "syllabus_unlock_syllabusId_idx" ON "syllabus_unlock"("syllabusId");

-- CreateIndex
CREATE INDEX "syllabus_approval_syllabusId_idx" ON "syllabus_approval"("syllabusId");

-- CreateIndex
CREATE INDEX "_MeetingAttendees_B_index" ON "_MeetingAttendees"("B");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_officialVersionId_key" ON "syllabus"("officialVersionId");

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_officialVersionId_fkey" FOREIGN KEY ("officialVersionId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_version" ADD CONSTRAINT "syllabus_version_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_version" ADD CONSTRAINT "syllabus_version_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_meeting" ADD CONSTRAINT "review_meeting_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_meeting" ADD CONSTRAINT "review_meeting_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_meeting" ADD CONSTRAINT "review_meeting_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_reviewedVersionId_fkey" FOREIGN KEY ("reviewedVersionId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "review_meeting"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_givenById_fkey" FOREIGN KEY ("givenById") REFERENCES "reviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_respondedById_fkey" FOREIGN KEY ("respondedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_resultingVersionId_fkey" FOREIGN KEY ("resultingVersionId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_unlock" ADD CONSTRAINT "syllabus_unlock_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_unlock" ADD CONSTRAINT "syllabus_unlock_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_approval" ADD CONSTRAINT "syllabus_approval_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_approval" ADD CONSTRAINT "syllabus_approval_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_approval" ADD CONSTRAINT "syllabus_approval_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingAttendees" ADD CONSTRAINT "_MeetingAttendees_A_fkey" FOREIGN KEY ("A") REFERENCES "review_meeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_MeetingAttendees" ADD CONSTRAINT "_MeetingAttendees_B_fkey" FOREIGN KEY ("B") REFERENCES "reviewer"("id") ON DELETE CASCADE ON UPDATE CASCADE;


-- Versions are immutable (README §7, rule 1): refuse any UPDATE or DELETE, whoever runs it.
CREATE FUNCTION "syllabus_version_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'syllabus_version rows are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "syllabus_version_no_change"
  BEFORE UPDATE OR DELETE ON "syllabus_version"
  FOR EACH ROW EXECUTE FUNCTION "syllabus_version_immutable"();
