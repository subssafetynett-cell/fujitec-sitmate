import { formatUserDisplayName } from "./plainName";

/** "Jane Doe (jane@company.com)" for list tables and detail headers. */
export function formatSubmitterDisplay(submittedBy) {
  if (!submittedBy) return "—";
  const name = formatUserDisplayName(submittedBy);
  const email = (submittedBy.email || "").trim();
  if (name && email) return `${name} (${email})`;
  return name || email || "—";
}
