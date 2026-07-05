-- AlterTable
ALTER TABLE "User" ADD COLUMN "passwordResetCodeHash" TEXT;
ALTER TABLE "User" ADD COLUMN "passwordResetCodeExpiresAt" TIMESTAMP(3);
