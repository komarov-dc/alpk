-- AlterTable
ALTER TABLE "public"."projects" ADD COLUMN     "isSystem" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "templateId" TEXT;
