-- Speed up Create Sites list/filter and cascade deletes.
CREATE INDEX IF NOT EXISTS "Site_clientId_idx" ON "Site"("clientId");
CREATE INDEX IF NOT EXISTS "Site_createdAt_idx" ON "Site"("createdAt");
CREATE INDEX IF NOT EXISTS "Site_managerId_idx" ON "Site"("managerId");
CREATE INDEX IF NOT EXISTS "Site_isActive_idx" ON "Site"("isActive");
CREATE INDEX IF NOT EXISTS "SiteDocument_siteId_idx" ON "SiteDocument"("siteId");
CREATE INDEX IF NOT EXISTS "SiteDocument_subfolderId_idx" ON "SiteDocument"("subfolderId");
