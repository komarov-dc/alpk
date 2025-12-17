/*
  Warnings:

  - The values [THERAPIST] on the enum `UserRole` will be removed. If these variants are still used in the database, this will fail.

*/
-- AlterEnum: Replace THERAPIST with CONSULTANT
BEGIN;
CREATE TYPE "public"."UserRole_new" AS ENUM ('ADMIN', 'CONSULTANT', 'SUPPORT', 'USER');
ALTER TABLE "public"."User" ALTER COLUMN "role" DROP DEFAULT;
ALTER TABLE "public"."User" ALTER COLUMN "role" TYPE "public"."UserRole_new" USING (
  CASE 
    WHEN "role"::text = 'THERAPIST' THEN 'CONSULTANT'::"public"."UserRole_new"
    ELSE "role"::text::"public"."UserRole_new"
  END
);
ALTER TYPE "public"."UserRole" RENAME TO "UserRole_old";
ALTER TYPE "public"."UserRole_new" RENAME TO "UserRole";
DROP TYPE "public"."UserRole_old";
ALTER TABLE "public"."User" ALTER COLUMN "role" SET DEFAULT 'USER';
COMMIT;

-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "consultantId" TEXT;

-- CreateIndex
CREATE INDEX "User_consultantId_idx" ON "public"."User"("consultantId");

-- AddForeignKey
ALTER TABLE "public"."User" ADD CONSTRAINT "User_consultantId_fkey" FOREIGN KEY ("consultantId") REFERENCES "public"."User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
