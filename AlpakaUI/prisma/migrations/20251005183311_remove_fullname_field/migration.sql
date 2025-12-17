/*
  Warnings:

  - You are about to drop the column `fullName` on the `User` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "public"."User" DROP COLUMN "fullName",
ALTER COLUMN "firstName" DROP DEFAULT,
ALTER COLUMN "lastName" DROP DEFAULT;
