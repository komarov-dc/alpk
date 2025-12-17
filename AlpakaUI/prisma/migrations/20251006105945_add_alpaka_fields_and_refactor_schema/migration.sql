/*
  Warnings:

  - The values [SIMPLIFIED,ANALYTICAL,QUANTITATIVE] on the enum `ReportType` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `respondentName` on the `Session` table. All the data in the column will be lost.
  - Made the column `userId` on table `Session` required. This step will fail if there are existing NULL values in that column.
  - Made the column `phone` on table `User` required. This step will fail if there are existing NULL values in that column.
  - Made the column `birthDate` on table `User` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterEnum
BEGIN;
CREATE TYPE "ReportType_new" AS ENUM ('FULL', 'ADAPTED', 'SCORE_TABLE');
ALTER TABLE "Report" ALTER COLUMN "type" TYPE "ReportType_new" USING ("type"::text::"ReportType_new");
ALTER TYPE "ReportType" RENAME TO "ReportType_old";
ALTER TYPE "ReportType_new" RENAME TO "ReportType";
DROP TYPE "public"."ReportType_old";
COMMIT;

-- DropForeignKey
ALTER TABLE "public"."Session" DROP CONSTRAINT "Session_userId_fkey";

-- AlterTable
ALTER TABLE "Session" DROP COLUMN "respondentName",
ADD COLUMN     "alpakaJobId" TEXT,
ADD COLUMN     "alpakaJobStatus" TEXT,
ALTER COLUMN "userId" SET NOT NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "phone" SET NOT NULL,
ALTER COLUMN "birthDate" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
