-- Rate-limit tracking for forgot-password requests (per email / per IP)
CREATE TABLE IF NOT EXISTS "PasswordResetAttempt" (
    "id" TEXT NOT NULL,
    "emailHash" TEXT NOT NULL,
    "ipHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetAttempt_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PasswordResetAttempt_emailHash_createdAt_idx"
    ON "PasswordResetAttempt"("emailHash", "createdAt");

CREATE INDEX IF NOT EXISTS "PasswordResetAttempt_ipHash_createdAt_idx"
    ON "PasswordResetAttempt"("ipHash", "createdAt");
