import type {
  Activity,
  Concern,
  NonConformance,
  Overview,
  SheqFormRecord,
  User,
} from "@/data/sheq";
import { sameCompany } from "@/lib/auth";
import { computeSheqComplianceForKind } from "@/components/sheq/document-forms/sheq-service-forms";

const SCORED = new Set(["sheq-service-report", "sheq-installation-report"]);

function normName(value: string | undefined | null) {
  return String(value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function formBelongsToUser(form: SheqFormRecord, user: User) {
  if (form.createdById && form.createdById === user.id) return true;
  const userName = normName(user.name);
  if (!userName) return false;
  if (form.createdByName && normName(form.createdByName) === userName) return true;
  if (!form.createdById) {
    const contact = normName(form.formData?.siteContact);
    const briefed = normName(form.formData?.briefedBy);
    if (contact === userName || briefed === userName) return true;
  }
  return false;
}

export function formInCompany(
  form: SheqFormRecord,
  companyName: string,
  usersById: Map<string, User>,
) {
  if (form.company && sameCompany(form.company, companyName)) return true;
  if (form.createdById) {
    const owner = usersById.get(form.createdById);
    if (owner && sameCompany(owner.company, companyName)) return true;
  }
  if (form.createdByName) {
    for (const u of usersById.values()) {
      if (
        sameCompany(u.company, companyName) &&
        normName(u.name) === normName(form.createdByName)
      ) {
        return true;
      }
    }
  }
  return false;
}

export function concernInCompany(
  concern: Concern,
  companyUsers: User[],
) {
  if (concern.anonymous) return false;
  const reporter = normName(concern.reporter);
  return companyUsers.some((u) => normName(u.name) === reporter);
}

export function computeFormCompliance(forms: SheqFormRecord[]) {
  let total = 0;
  let count = 0;
  let findings = 0;
  for (const f of forms) {
    if (!f.kind || !SCORED.has(f.kind) || !f.formData) continue;
    const summary = computeSheqComplianceForKind(f.kind, f.formData);
    if (!summary || summary.max <= 0) continue;
    total += summary.percent;
    findings += summary.ncCount;
    count += 1;
  }
  return {
    avg: count ? Math.round(total / count) : 0,
    scored: count,
    findings,
    totalForms: forms.length,
  };
}

export function buildScopedOverview(
  base: Overview,
  input: {
    companies: number;
    users: User[];
    sites: number;
    forms: SheqFormRecord[];
    nonConformances: NonConformance[];
    concerns: Concern[];
    formAvg: number;
  },
): Overview {
  const openNc = input.nonConformances.filter(
    (n) => (n.status || n.stage) !== "Closed" && (n.status || n.stage) !== "Rejected",
  ).length;
  const closedNc = input.nonConformances.filter(
    (n) => (n.status || n.stage) === "Closed",
  ).length;
  const openConcerns = input.concerns.filter((c) => c.status !== "Closed").length;
  const closedConcerns = input.concerns.filter((c) => c.status === "Closed").length;
  const activeUsers = input.users.filter((u) => u.status === "Active").length;
  const performanceScore =
    input.formAvg > 0
      ? input.formAvg
      : base.performanceScore;
  const compliance =
    input.formAvg > 0 ? input.formAvg : base.compliance;

  return {
    ...base,
    companies: input.companies,
    users: input.users.length,
    activeUsers,
    sites: input.sites,
    openNonConformances: openNc,
    closedNonConformances: closedNc,
    openConcerns,
    closedConcerns,
    performanceScore,
    compliance,
  };
}

export function filterActivitiesForUser(activities: Activity[], user: User) {
  const name = normName(user.name);
  if (!name) return activities;
  return activities.filter((a) => normName(a.who) === name);
}

export function filterActivitiesForCompany(
  activities: Activity[],
  companyUsers: User[],
) {
  const names = new Set(companyUsers.map((u) => normName(u.name)).filter(Boolean));
  if (names.size === 0) return activities;
  return activities.filter((a) => names.has(normName(a.who)));
}

function monthKey(dateStr: string | undefined | null) {
  const raw = String(dateStr ?? "").slice(0, 7);
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(key: string) {
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];
  const [y, m] = key.split("-");
  const idx = Number(m) - 1;
  if (!y || Number.isNaN(idx) || idx < 0 || idx > 11) return key;
  return `${months[idx]} ${y.slice(2)}`;
}

/** Last N calendar month keys (YYYY-MM), oldest → newest. */
export function recentMonthKeys(count = 6) {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i -= 1) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(
      `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`,
    );
  }
  return keys;
}

function ncIsClosed(n: NonConformance) {
  const s = n.status || n.stage;
  return s === "Closed";
}

/** Monthly submitted vs closed forms (live). */
export function buildMonthlyFormActivity(forms: SheqFormRecord[], months = 6) {
  return recentMonthKeys(months).map((key) => {
    const inMonth = forms.filter((f) => monthKey(f.raised) === key);
    return {
      month: monthLabel(key),
      submitted: inMonth.filter((f) => f.status !== "Draft").length,
      closed: inMonth.filter((f) => f.status === "Closed").length,
    };
  });
}

/** Monthly NC raised/closed + concerns raised (live). */
export function buildMonthlyNcConcernTrend(
  nonConformances: NonConformance[],
  concerns: Concern[],
  months = 6,
) {
  return recentMonthKeys(months).map((key) => {
    const ncs = nonConformances.filter((n) => monthKey(n.raised) === key);
    return {
      month: monthLabel(key),
      raised: ncs.length,
      closed: ncs.filter(ncIsClosed).length,
      concerns: concerns.filter((c) => monthKey(c.raised) === key).length,
    };
  });
}

/** Monthly avg form compliance + NC findings from scored reports (live). */
export function buildMonthlyComplianceTrend(forms: SheqFormRecord[], months = 6) {
  return recentMonthKeys(months).map((key) => {
    let total = 0;
    let count = 0;
    let findings = 0;
    for (const f of forms) {
      if (monthKey(f.raised) !== key) continue;
      if (!f.kind || !SCORED.has(f.kind) || !f.formData) continue;
      const summary = computeSheqComplianceForKind(f.kind, f.formData);
      if (!summary || summary.max <= 0) continue;
      total += summary.percent;
      findings += summary.ncCount;
      count += 1;
    }
    return {
      month: monthLabel(key),
      compliance: count ? Math.round(total / count) : 0,
      findings,
      reports: count,
    };
  });
}

/** Progress-bar style breakdown for live work mix. */
export function buildWorkMixBars(
  forms: SheqFormRecord[],
  nonConformances: NonConformance[],
  concerns: Concern[],
) {
  const service = forms.filter((f) => f.kind === "sheq-service-report").length;
  const installation = forms.filter(
    (f) => f.kind === "sheq-installation-report",
  ).length;
  const otherForms = Math.max(0, forms.length - service - installation);
  const closedNc = nonConformances.filter(ncIsClosed).length;
  const ncClosure =
    nonConformances.length > 0
      ? Math.round((closedNc / nonConformances.length) * 100)
      : 0;
  const closedConcerns = concerns.filter((c) => c.status === "Closed").length;
  const concernClosure =
    concerns.length > 0
      ? Math.round((closedConcerns / concerns.length) * 100)
      : 0;
  const submittedForms = forms.filter((f) => f.status !== "Draft").length;
  const formSubmitRate =
    forms.length > 0 ? Math.round((submittedForms / forms.length) * 100) : 0;

  return [
    {
      label: "Service reports",
      value: service,
      percent: forms.length ? Math.round((service / forms.length) * 100) : 0,
      hint: `${service} of ${forms.length} forms`,
    },
    {
      label: "Installation reports",
      value: installation,
      percent: forms.length
        ? Math.round((installation / forms.length) * 100)
        : 0,
      hint: `${installation} of ${forms.length} forms`,
    },
    {
      label: "Other forms",
      value: otherForms,
      percent: forms.length
        ? Math.round((otherForms / forms.length) * 100)
        : 0,
      hint: `${otherForms} of ${forms.length} forms`,
    },
    {
      label: "NC closure rate",
      value: ncClosure,
      percent: ncClosure,
      hint: `${closedNc} closed of ${nonConformances.length}`,
    },
    {
      label: "Concern closure rate",
      value: concernClosure,
      percent: concernClosure,
      hint: `${closedConcerns} closed of ${concerns.length}`,
    },
    {
      label: "Forms submitted rate",
      value: formSubmitRate,
      percent: formSubmitRate,
      hint: `${submittedForms} submitted of ${forms.length}`,
    },
  ];
}
