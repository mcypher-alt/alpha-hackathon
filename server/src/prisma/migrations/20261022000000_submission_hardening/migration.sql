ALTER TABLE "LoanApplication" ADD COLUMN "version" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "LoanApplication" ADD COLUMN "financialSnapshot" JSONB;
ALTER TABLE "ApplicationDocument" ADD COLUMN "content" TEXT;
