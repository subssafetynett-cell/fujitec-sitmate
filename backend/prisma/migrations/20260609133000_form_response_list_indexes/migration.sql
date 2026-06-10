CREATE INDEX "FormResponse_category_createdAt_idx" ON "FormResponse"("category", "createdAt");
CREATE INDEX "FormResponse_submittedById_category_createdAt_idx" ON "FormResponse"("submittedById", "category", "createdAt");
CREATE INDEX "FormResponse_answers_gin_idx" ON "FormResponse" USING GIN ("answers");
