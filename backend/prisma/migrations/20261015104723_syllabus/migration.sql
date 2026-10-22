-- CreateEnum
CREATE TYPE "SyllabusStatus" AS ENUM ('DRAFT');

-- CreateTable
CREATE TABLE "syllabus" (
    "id" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "format" "SyllabusFormat" NOT NULL,
    "status" "SyllabusStatus" NOT NULL DEFAULT 'DRAFT',
    "content" JSONB NOT NULL,
    "revision" INTEGER NOT NULL DEFAULT 1,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "syllabus_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "syllabus_schemeId_courseId_key" ON "syllabus"("schemeId", "courseId");

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "scheme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "syllabus" ADD CONSTRAINT "syllabus_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;
