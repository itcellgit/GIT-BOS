-- AlterEnum
ALTER TYPE "Role" ADD VALUE 'SUPER_ADMIN';

-- AlterTable
ALTER TABLE "user" ADD COLUMN     "passwordChangeRequired" BOOLEAN NOT NULL DEFAULT false;
