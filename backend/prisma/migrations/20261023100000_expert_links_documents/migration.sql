-- CreateEnum
CREATE TYPE "DocumentKind" AS ENUM ('SYLLABUS');

-- AlterTable
ALTER TABLE "review_input" ADD COLUMN     "expertLinkId" TEXT;

-- CreateTable
CREATE TABLE "expert_link" (
    "id" TEXT NOT NULL,
    "syllabusId" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "reviewerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "lastUsedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expert_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "generated_document" (
    "id" TEXT NOT NULL,
    "versionId" TEXT NOT NULL,
    "kind" "DocumentKind" NOT NULL,
    "pdf" BYTEA NOT NULL,
    "sha256" TEXT NOT NULL,
    "layoutVersion" INTEGER NOT NULL,
    "frozen" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "generated_document_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expert_link_tokenHash_key" ON "expert_link"("tokenHash");

-- CreateIndex
CREATE INDEX "expert_link_syllabusId_idx" ON "expert_link"("syllabusId");

-- CreateIndex
CREATE UNIQUE INDEX "generated_document_versionId_kind_key" ON "generated_document"("versionId", "kind");

-- AddForeignKey
ALTER TABLE "review_input" ADD CONSTRAINT "review_input_expertLinkId_fkey" FOREIGN KEY ("expertLinkId") REFERENCES "expert_link"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_link" ADD CONSTRAINT "expert_link_syllabusId_fkey" FOREIGN KEY ("syllabusId") REFERENCES "syllabus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_link" ADD CONSTRAINT "expert_link_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_link" ADD CONSTRAINT "expert_link_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "reviewer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expert_link" ADD CONSTRAINT "expert_link_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "user"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "generated_document" ADD CONSTRAINT "generated_document_versionId_fkey" FOREIGN KEY ("versionId") REFERENCES "syllabus_version"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Frozen documents never change (README §8): an approved PDF reprints exactly as it was approved.
CREATE FUNCTION "generated_document_frozen"() RETURNS trigger AS $$
BEGIN
  IF OLD."frozen" THEN
    RAISE EXCEPTION 'frozen generated_document rows are immutable';
  END IF;
  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "generated_document_no_change"
  BEFORE UPDATE OR DELETE ON "generated_document"
  FOR EACH ROW EXECUTE FUNCTION "generated_document_frozen"();
