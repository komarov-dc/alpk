-- AlterTable
ALTER TABLE "public"."Session" ADD COLUMN     "followUpQuestionsAsked" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "hasFollowUpQuestions" BOOLEAN NOT NULL DEFAULT false,
ALTER COLUMN "totalQuestions" SET DEFAULT 5;
