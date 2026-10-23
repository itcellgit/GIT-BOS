-- AlterTable
ALTER TABLE "syllabus" ADD COLUMN     "carriedFromId" TEXT;

-- CreateTable
CREATE TABLE "scheme_amendment" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "details" JSONB,
    "affectedCount" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheme_amendment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "syllabus_revision_flag" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "amendmentId" TEXT NOT NULL,
    "errorCount" INTEGER,
    "warningCount" INTEGER,
    "resolvedAt" TIMESTAMP(3),
    "resolvedById" TEXT,
    "resolution" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "syllabus_revision_flag_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scheme_amendment_schemeId_createdAt_idx" ON "scheme_amendment"("schemeId", "createdAt");

-- CreateIndex
CREATE INDEX "syllabus_revision_flag_syllabusId_resolvedAt_idx" ON "syllabus_revision_flag"("syllabusId", "resolvedAt");

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_revision_flag_syllabusId_amendmentId_key" ON "syllabus_revision_flag"("syllabusId", "amendmentId");

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_carriedFromId_fkey" FOREIGN KEY ("carriedFromId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_amendment" ADD CONSTRAINT "scheme_amendment_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_amendment" ADD CONSTRAINT "scheme_amendment_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_revision_flag" ADD CONSTRAINT "syllabus_revision_flag_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabus"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_revision_flag" ADD CONSTRAINT "syllabus_revision_flag_amendmentId_fkey" FOREIGN KEY ("amendmentId") REFERENCES "scheme_amendment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus_revision_flag" ADD CONSTRAINT "syllabus_revision_flag_resolvedById_fkey" FOREIGN KEY ("resolvedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
