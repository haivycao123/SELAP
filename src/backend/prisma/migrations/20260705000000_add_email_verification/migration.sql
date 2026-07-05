-- AlterTable
ALTER TABLE "User" ADD COLUMN "emailVerifiedAt" TIMESTAMP(3);
ALTER TABLE "User" ADD COLUMN "emailVerificationCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "emailVerificationCodeExpiresAt" TIMESTAMP(3);

-- Existing users predate email verification, so mark them as verified.
UPDATE "User"
SET "emailVerifiedAt" = CURRENT_TIMESTAMP
WHERE "emailVerifiedAt" IS NULL;
