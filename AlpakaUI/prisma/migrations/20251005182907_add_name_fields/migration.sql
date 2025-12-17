-- AlterTable
ALTER TABLE "public"."User" ADD COLUMN     "firstName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "lastName" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "middleName" TEXT;

-- Data migration: Split fullName into lastName, firstName, middleName
-- Assuming format: "Фамилия Имя Отчество" or "Фамилия Имя"
UPDATE "public"."User"
SET 
  "lastName" = COALESCE(split_part("fullName", ' ', 1), ''),
  "firstName" = COALESCE(split_part("fullName", ' ', 2), ''),
  "middleName" = NULLIF(split_part("fullName", ' ', 3), '')
WHERE "fullName" IS NOT NULL AND "fullName" != '';
