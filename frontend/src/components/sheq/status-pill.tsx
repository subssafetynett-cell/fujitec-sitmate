import { cn } from "@/lib/utils";

const map: Record<string, string> = {
  // generic
  Active: "bg-success/12 text-success",
  Inactive: "bg-muted text-muted-foreground",
  Completed: "bg-success/12 text-success",
  Closed: "bg-success/12 text-success",
  Published: "bg-success/12 text-success",
  "Scheduled": "bg-info/15 text-info-foreground",
  "In Progress": "bg-info/15 text-info-foreground",
  "Action Underway": "bg-info/15 text-info-foreground",
  Investigating: "bg-info/15 text-info-foreground",
  Assigned: "bg-accent text-accent-foreground",
  Reported: "bg-accent text-accent-foreground",
  Onboarding: "bg-accent text-accent-foreground",
  Draft: "bg-muted text-muted-foreground",
  Archived: "bg-muted text-muted-foreground",
  "Awaiting Review": "bg-warning/18 text-warning",
  "Pending Admin Approval": "bg-warning/18 text-warning",
  "Pending Admin Review": "bg-warning/18 text-warning",
  Verification: "bg-warning/18 text-warning",
  "Corrective Action": "bg-warning/18 text-warning",
  Reopened: "bg-warning/18 text-warning",
  Rejected: "bg-destructive/12 text-destructive",
  Open: "bg-destructive/12 text-destructive",
  Overdue: "bg-destructive/12 text-destructive",
  Suspended: "bg-destructive/12 text-destructive",
  Invited: "bg-info/15 text-info-foreground",
  // severity / priority
  Low: "bg-muted text-muted-foreground",
  Medium: "bg-warning/18 text-warning",
  High: "bg-destructive/12 text-destructive",
  Critical: "bg-destructive text-destructive-foreground",
};

export function StatusPill({ value, className }: { value: string; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-medium",
        map[value] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {value}
    </span>
  );
}
