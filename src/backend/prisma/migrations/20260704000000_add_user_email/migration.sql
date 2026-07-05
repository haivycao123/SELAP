-- AlterTable
ALTER TABLE "User" ADD COLUMN "email" TEXT;

-- Backfill existing users so the new required column can be enforced safely.
UPDATE "User"
SET "email" = CONCAT('user_', "id", '@placeholder.local')
WHERE "email" IS NULL;

-- AlterTable
ALTER TABLE "User" ALTER COLUMN "email" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
