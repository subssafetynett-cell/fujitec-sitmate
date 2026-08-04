import { Fragment, useRef, type ChangeEvent, type ReactNode } from "react";
import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Template } from "@/data/sheq";
import { uploadFileToCloudinary } from "@/lib/cloudinary-upload";
import { cn } from "@/lib/utils";
import {
  DocumentChrome,
  EditableValue,
  FieldRow,
  type DocumentFormBindings,
} from "./chrome";

type Question = { id: string; label: string };
type Subsection = { code: string; title: string; questions: Question[] };
type Section = { code: string; title: string; subsections: Subsection[] };

const SCORE_OPTIONS = ["1", "2", "3", "N/A", "NIU"] as const;
const SCORE_MAX = 3;
const HS_STATUS = ["GREEN", "AMBER", "RED"] as const;
const NOTIFY = ["Installation Director", "SHEQ Advisor", "Principal Contractor"] as const;

const SERVICE_SECTIONS: Section[] = [
  {
    code: "1",
    title: "1. Vehicle",
    subsections: [
      {
        code: "1.1",
        title: "1.1 Overall condition",
        questions: [
          { id: "tyres", label: "Tyres" },
          { id: "windows", label: "Windows, mirrors etc" },
          { id: "mot", label: "MOT/Road Tax" },
          { id: "service", label: "Service date" },
        ],
      },
      {
        code: "1.2",
        title: "1.2 Emergency equipment",
        questions: [
          { id: "first_aid", label: "First Aid Kit" },
          { id: "fire_ext", label: "Fire extinguisher" },
        ],
      },
      {
        code: "1.3",
        title: "1.3 Site registration",
        questions: [
          { id: "signed_in", label: "Signed in/visitors book" },
          { id: "permit", label: "Permit to work in place" },
        ],
      },
    ],
  },
  {
    code: "2",
    title: "2. Site condition",
    subsections: [
      {
        code: "2.1",
        title: "2.1 Access to point of work",
        questions: [
          { id: "normal", label: "Normal conditions" },
          { id: "restricted", label: "Restricted access" },
        ],
      },
      {
        code: "2.2",
        title: "2.2 Lighting",
        questions: [
          { id: "general", label: "General" },
          { id: "access_emergency", label: "Access / Emergency" },
        ],
      },
      {
        code: "2.3",
        title: "2.3 Entrance and fall protection",
        questions: [
          { id: "guardrails", label: "Guardrails and Toeboards" },
          { id: "ladders", label: "Secured Ladder(s)" },
        ],
      },
    ],
  },
  {
    code: "3",
    title: "3. RAMS documentation",
    subsections: [
      {
        code: "3.1",
        title: "3.1 Method statements",
        questions: [
          { id: "in_place", label: "Method statement in place" },
          { id: "current", label: "Current and up to date" },
        ],
      },
      {
        code: "3.2",
        title: "3.2 Risk assessments",
        questions: [
          { id: "available", label: "Available at the point of work/van" },
        ],
      },
      {
        code: "3.3",
        title: "3.3 COSHH",
        questions: [
          { id: "msds", label: "Assessments / MSDS available" },
          { id: "controls", label: "Following control measures" },
        ],
      },
    ],
  },
  {
    code: "4",
    title: "4. Tools and equipment",
    subsections: [
      {
        code: "4.1",
        title: "4.1 PPE",
        questions: [
          { id: "correct", label: "Correct PPE being used for task" },
          { id: "gloves", label: "Gloves issued" },
          { id: "fit", label: "Fit for purpose and tested?" },
        ],
      },
      {
        code: "4.2",
        title: "4.2 Power tools",
        questions: [
          { id: "pat", label: "Fit for purpose and have been tested (PAT)?" },
          { id: "used", label: "Correctly used?" },
        ],
      },
      {
        code: "4.3",
        title: "4.3 Hand tools",
        questions: [
          { id: "suitable", label: "Suitable and fit for purpose?" },
          { id: "used", label: "Tools correctly used?" },
        ],
      },
      {
        code: "4.4",
        title: "4.4 Test equipment",
        questions: [
          { id: "calibrated", label: "Suitable and calibrated?" },
          { id: "fit", label: "Fit for purpose?" },
        ],
      },
      {
        code: "4.5",
        title: "4.5 Barriers",
        questions: [
          { id: "suitable", label: "Suitable and fit for purpose?" },
          { id: "used", label: "Correctly used?" },
        ],
      },
    ],
  },
  {
    code: "5",
    title: "5. Lifting equipment",
    subsections: [
      {
        code: "5.1",
        title: "5.1 Lifting equipment / accessories",
        questions: [
          { id: "suitable", label: "Suitable and fit for purpose?" },
          { id: "cert", label: "Inspection / certification" },
        ],
      },
    ],
  },
  {
    code: "6",
    title: "6. Documentation",
    subsections: [
      {
        code: "6.1",
        title: "6.1 Maintenance documentation",
        questions: [
          { id: "paperwork", label: "Correct service paperwork" },
          { id: "order", label: "Service order number correct" },
        ],
      },
      {
        code: "6.2",
        title: "6.2 Process documentation",
        questions: [
          { id: "manual", label: "Operations and maintenance manual" },
        ],
      },
    ],
  },
  {
    code: "7",
    title: "7. Training",
    subsections: [
      {
        code: "7.1",
        title: "7.1 Competency",
        questions: [
          { id: "technical", label: "Technical" },
          { id: "hs", label: "Health and Safety" },
          { id: "manual", label: "Manual handling" },
          { id: "product", label: "Product training" },
          { id: "tbt", label: "Tool Box Talks" },
        ],
      },
    ],
  },
  {
    code: "8",
    title: "8. General",
    subsections: [
      {
        code: "8.1",
        title: "8.1 Accident reporting",
        questions: [{ id: "aware", label: "Aware of procedure" }],
      },
      {
        code: "8.2",
        title: "8.2 Fire",
        questions: [
          { id: "assembly", label: "Aware of fire assembly point" },
          { id: "hazards", label: "Fire hazards" },
          { id: "extinguisher", label: "Fire extinguisher" },
        ],
      },
    ],
  },
  {
    code: "9",
    title: "9. Safety essentials",
    subsections: [
      {
        code: "9.1",
        title: "9.1 Electrical isolation",
        questions: [
          { id: "loto", label: "LOTO in use when required / appropriate" },
        ],
      },
      {
        code: "9.2",
        title: "9.2 Car top hand control",
        questions: [
          { id: "in_use", label: "In use when required / appropriate" },
        ],
      },
      {
        code: "9.3",
        title: "9.3 Working in pit",
        questions: [
          { id: "pit_props", label: "Pit props / baffles in use when required" },
        ],
      },
      {
        code: "9.4",
        title: "9.4 Environment",
        questions: [{ id: "spillage", label: "Spillage kits / management" }],
      },
      {
        code: "9.5",
        title: "9.5 Waste management",
        questions: [
          {
            id: "streams",
            label: "Procedure for disposing various waste streams",
          },
        ],
      },
      {
        code: "9.6",
        title: "9.6 General housekeeping",
        questions: [
          {
            id: "housekeeping",
            label: "Housekeeping general and task specific",
          },
        ],
      },
    ],
  },
];

const INSTALLATION_SECTIONS: Section[] = [
  {
    code: "1",
    title: "1. Project documentation",
    subsections: [
      {
        code: "1.1",
        title: "1.1 Risk assessments & method statement (RAMS)",
        questions: [
          { id: "in_place", label: "RAMS in place" },
          { id: "reviewed", label: "Reviewed and signed" },
          { id: "available", label: "Available at point of work" },
        ],
      },
      {
        code: "1.2",
        title: "1.2 Registers",
        questions: [
          { id: "equipment", label: "Equipment register" },
          { id: "plant", label: "Plant register" },
          { id: "temporary", label: "Temporary works register" },
        ],
      },
      {
        code: "1.3",
        title: "1.3 Inspection records",
        questions: [
          { id: "scaffold", label: "Scaffold inspections" },
          { id: "lifting", label: "Lifting equipment inspections" },
          { id: "excavation", label: "Excavation inspections" },
        ],
      },
    ],
  },
  {
    code: "2",
    title: "2. Site conditions",
    subsections: [
      {
        code: "2.1",
        title: "2.1 Access / egress to point of work",
        questions: [
          { id: "safe", label: "Safe conditions" },
          {
            id: "escape",
            label: "Emergency escape routes clear at all times",
          },
        ],
      },
      {
        code: "2.2",
        title: "2.2 Lighting",
        questions: [
          { id: "general", label: "General lighting" },
          { id: "access", label: "Access routes lighting" },
          { id: "task", label: "Task lighting" },
        ],
      },
      {
        code: "2.3",
        title: "2.3 Welfare & environment",
        questions: [
          { id: "canteen", label: "Canteen and rest room" },
          { id: "toilets", label: "Toilets and washing facilities" },
          { id: "first_aid", label: "First aid facilities" },
          { id: "notices", label: "Notices and Statutory signs" },
          {
            id: "climate",
            label: "Working climate ie dust/noise/vibration etc",
          },
        ],
      },
    ],
  },
  {
    code: "3",
    title: "3. Sub contractors",
    subsections: [
      {
        code: "3.1",
        title: "3.1 Subcontractors on site",
        questions: [
          {
            id: "name_trade",
            label: "Name and Trade of Sub Contractors on Site",
          },
          {
            id: "qualifications",
            label: "Sub Contractors Relevant qualifications kept on",
          },
          { id: "ms_ra", label: "Subcontractors working to MS-RA" },
        ],
      },
      {
        code: "3.2",
        title: "3.2 Following control measures",
        questions: [
          { id: "knowledge", label: "Knowledge of risks/controls in place?" },
        ],
      },
    ],
  },
  {
    code: "4",
    title: "4. Tools and equipment",
    subsections: [
      {
        code: "4.1",
        title: "4.1 Power tools",
        questions: [
          {
            id: "pat",
            label: "Fit for purpose and have been tested (PAT)?",
          },
        ],
      },
      {
        code: "4.2",
        title: "4.2 Barriers",
        questions: [
          { id: "suitable", label: "Suitable and fit for purpose?" },
          { id: "used", label: "Correctly used?" },
        ],
      },
      {
        code: "4.3",
        title: "4.3 Hand tools",
        questions: [
          { id: "suitable", label: "Suitable and fit for purpose?" },
          { id: "used", label: "Tools correctly used?" },
        ],
      },
    ],
  },
  {
    code: "5",
    title: "5. Lift equipment & installation",
    subsections: [
      {
        code: "5.1",
        title: "5.1 LOLER",
        questions: [
          {
            id: "equip_cert",
            label: "Lifting equipment inspection/certification",
          },
          {
            id: "access_cert",
            label: "Lifting accessories inspection/certification",
          },
          {
            id: "weekly",
            label: "Weekly / daily inspections of equipment",
          },
        ],
      },
      {
        code: "5.2",
        title: "5.2 Material storage & disposal",
        questions: [
          { id: "stored", label: "Materials stored correctly" },
          { id: "waste", label: "Waste material disposed appropriately" },
          {
            id: "gas_struts",
            label: "Tool Box gas struts in good working conditions",
          },
        ],
      },
      {
        code: "5.3",
        title: "5.3 Electrical safety",
        questions: [
          { id: "signage", label: "Signage & tagging available?" },
          {
            id: "test_equip",
            label: "Condition of Test Equipment / calibration",
          },
        ],
      },
      {
        code: "5.4",
        title: "5.4 Shaft safety",
        questions: [
          { id: "machine_room", label: "Working inside machine room" },
          { id: "shaft", label: "Working inside the lift shaft" },
          {
            id: "crash_deck",
            label: "Crash deck inspected and scaff tag signed off?",
          },
          {
            id: "platform",
            label: "Working platform safe with handrails, midrails and toeboards",
          },
        ],
      },
      {
        code: "5.5",
        title: "5.5 Machinery guarding",
        questions: [
          {
            id: "guarding",
            label: "Fitted/compliant with current standards?",
          },
        ],
      },
    ],
  },
  {
    code: "6",
    title: "6. Working at heights",
    subsections: [
      {
        code: "6.1",
        title: "6.1 Working from work platforms",
        questions: [
          {
            id: "guard_rails",
            label: "Guard rails in place: main & intermediate",
          },
          { id: "access", label: "Safe access to platform" },
          { id: "load", label: "Platform not overloaded" },
        ],
      },
      {
        code: "6.2",
        title: "6.2 Ladders",
        questions: [
          { id: "fit", label: "Fit for purpose" },
          { id: "records", label: "Inspection records" },
          { id: "secured", label: "Secured / footed correctly" },
        ],
      },
      {
        code: "6.3",
        title: "6.3 Fall prevention",
        questions: [
          { id: "harness", label: "Harness / lanyard in use where required" },
          { id: "anchor", label: "Suitable anchor points" },
          { id: "edge", label: "Edge protection in place" },
        ],
      },
    ],
  },
  {
    code: "7",
    title: "7. General",
    subsections: [
      {
        code: "7.1",
        title: "7.1 Site induction / registration",
        questions: [
          { id: "site", label: "Site specific induction" },
          { id: "fujitec", label: "Fujitec Induction" },
          {
            id: "records",
            label: "Both Induction records maintained on file",
          },
        ],
      },
      {
        code: "7.2",
        title: "7.2 On site notification",
        questions: [
          {
            id: "client",
            label: "Client aware of presence on site - swipe in or sign in",
          },
        ],
      },
      {
        code: "7.3",
        title: "7.3 Accident reporting",
        questions: [
          {
            id: "procedure",
            label: "Accident Reporting Procedure in place",
          },
        ],
      },
      {
        code: "7.4",
        title: "7.4 Competence & training",
        questions: [
          { id: "tbt", label: "Technical/Tool Box Talks" },
          { id: "cscs", label: "CSCS" },
        ],
      },
      {
        code: "7.5",
        title: "7.5 Security & fire",
        questions: [
          { id: "security", label: "Site Security Level" },
          { id: "hazards", label: "Fire Hazards" },
          { id: "extinguishers", label: "Extinguishers" },
          { id: "call_points", label: "Call Points" },
          { id: "signage", label: "Fire signage and Information" },
        ],
      },
    ],
  },
  {
    code: "8",
    title: "8. Safety essentials",
    subsections: [
      {
        code: "8.1",
        title: "8.1 Entrance protection",
        questions: [
          { id: "hoardings", label: "Hoardings safe with locks in place" },
        ],
      },
      {
        code: "8.2",
        title: "8.2 Personal protective equipment",
        questions: [
          { id: "worn", label: "Worn at all times" },
          { id: "condition", label: "Condition of PPE" },
        ],
      },
      {
        code: "8.3",
        title: "8.3 Safety gear / pit props",
        questions: [
          { id: "available", label: "Available and in good condition" },
          { id: "used", label: "Used when required" },
        ],
      },
      {
        code: "8.5",
        title: "8.5 Two way communication",
        questions: [
          { id: "available", label: "Available on site" },
          { id: "tested", label: "Tested / working" },
        ],
      },
    ],
  },
];

type Props = {
  template: Template;
  bannerTitle: string;
  sections: Section[];
} & DocumentFormBindings;

function qKey(sectionCode: string, subsectionCode: string, questionId: string, suffix: "score" | "comment") {
  return `q_${sectionCode}_${subsectionCode.replace(".", "_")}_${questionId}_${suffix}`;
}

function ncKey(
  sectionCode: string,
  subsectionCode: string,
  questionId: string,
  suffix: "action" | "timing" | "person" | "closed",
) {
  return `nc_${sectionCode}_${subsectionCode.replace(".", "_")}_${questionId}_${suffix}`;
}

type NcFinding = {
  key: string;
  item: string;
  actionKey: string;
  timingKey: string;
  personKey: string;
  closedKey: string;
};

/** Questions scored "1" (non-compliant) become nonconformance findings. */
function listNonconformances(
  sections: Section[],
  values?: Record<string, string>,
): NcFinding[] {
  const rows: NcFinding[] = [];
  for (const section of sections) {
    for (const sub of section.subsections) {
      for (const q of sub.questions) {
        const score = values?.[qKey(section.code, sub.code, q.id, "score")] ?? "";
        if (score !== "1") continue;
        rows.push({
          key: `${section.code}_${sub.code}_${q.id}`,
          item: `${sub.title} — ${q.label}`,
          actionKey: ncKey(section.code, sub.code, q.id, "action"),
          timingKey: ncKey(section.code, sub.code, q.id, "timing"),
          personKey: ncKey(section.code, sub.code, q.id, "person"),
          closedKey: ncKey(section.code, sub.code, q.id, "closed"),
        });
      }
    }
  }
  return rows;
}

function photoKey(sectionCode: string) {
  return `section_${sectionCode}_photos`;
}

function parsePhotos(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (v): v is string =>
        typeof v === "string" &&
        (v.startsWith("data:image/") || /^https?:\/\//i.test(v)),
    );
  } catch {
    return [];
  }
}

function scoreValue(raw: string | undefined) {
  if (!raw) return null;
  if (raw === "N/A" || raw === "NIU") return raw;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function sectionTotals(section: Section, values?: Record<string, string>) {
  let score = 0;
  let max = 0;
  for (const sub of section.subsections) {
    for (const q of sub.questions) {
      const raw = values?.[qKey(section.code, sub.code, q.id, "score")];
      const v = scoreValue(raw);
      if (v == null || v === "N/A" || v === "NIU") continue;
      score += Math.min(Math.max(v, 0), SCORE_MAX);
      max += SCORE_MAX;
    }
  }
  return { score, max };
}

function reportTotals(sections: Section[], values?: Record<string, string>) {
  return sections.reduce(
    (acc, section) => {
      const t = sectionTotals(section, values);
      return { score: acc.score + t.score, max: acc.max + t.max };
    },
    { score: 0, max: 0 },
  );
}

function HeaderGrid({ values, onChange, editable }: DocumentFormBindings) {
  const bind = { values, onChange, editable };
  const head =
    "border border-black bg-[#003B5C] px-2 py-1.5 text-left text-[11px] font-bold uppercase tracking-wide text-white";
  return (
    <>
      <table className="w-full border-collapse table-fixed" data-export-break>
        <colgroup>
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
          <col style={{ width: "25%" }} />
        </colgroup>
        <thead>
          <tr data-export-break>
            {(["Client", "Engineer(s)", "Date", "Auditor"] as const).map((label) => (
              <th key={label} className={head}>
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          <tr data-export-break>
            {(
              [
                ["client", false],
                ["engineers", false],
                ["jobDate", false],
                ["auditor", false],
              ] as const
            ).map(([key]) => (
              <td key={key} className="border border-black align-top p-0">
                <EditableValue fieldKey={key} {...bind} className="min-h-10" />
              </td>
            ))}
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse table-fixed" data-export-break>
        <colgroup>
          <col style={{ width: "50%" }} />
          <col style={{ width: "50%" }} />
        </colgroup>
        <thead>
          <tr data-export-break>
            <th className={head}>Site address</th>
            <th className={head}>Service manager</th>
          </tr>
        </thead>
        <tbody>
          <tr data-export-break>
            <td className="border border-black align-top p-0">
              <EditableValue fieldKey="siteAddress" multiline {...bind} className="min-h-14" />
            </td>
            <td className="border border-black align-top p-0">
              <EditableValue fieldKey="serviceManager" {...bind} className="min-h-14" />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse table-fixed border-b border-black" data-export-break>
        <colgroup>
          <col style={{ width: "50%" }} />
          <col style={{ width: "50%" }} />
        </colgroup>
        <thead>
          <tr data-export-break>
            <th className={head}>Equipment ID</th>
            <th className={head}>Site contact</th>
          </tr>
        </thead>
        <tbody>
          <tr data-export-break>
            <td className="border border-black align-top p-0">
              <EditableValue fieldKey="equipmentId" {...bind} className="min-h-12" />
            </td>
            <td className="border border-black align-top p-0">
              <EditableValue fieldKey="siteContact" multiline {...bind} className="min-h-12" />
            </td>
          </tr>
        </tbody>
      </table>
    </>
  );
}

function ProjectSummary({ values, onChange, editable }: DocumentFormBindings) {
  const status = (values?.hsStatus ?? "").toUpperCase();
  const selected = new Set(
    (values?.notifyRoles ?? "")
      .split("|")
      .map((s) => s.trim())
      .filter(Boolean),
  );

  const statusStyles: Record<
    (typeof HS_STATUS)[number],
    { selected: string; unselected: string; dot: string; export: { bg: string; border: string; fg: string } }
  > = {
    GREEN: {
      selected: "border-emerald-700 bg-emerald-600 text-white shadow-sm",
      unselected: "border-emerald-300 bg-white text-emerald-800",
      dot: "bg-emerald-600",
      export: { bg: "#059669", border: "#047857", fg: "#ffffff" },
    },
    AMBER: {
      selected: "border-amber-600 bg-amber-500 text-white shadow-sm",
      unselected: "border-amber-300 bg-white text-amber-800",
      dot: "bg-amber-500",
      export: { bg: "#F59E0B", border: "#D97706", fg: "#ffffff" },
    },
    RED: {
      selected: "border-red-700 bg-red-600 text-white shadow-sm",
      unselected: "border-red-300 bg-white text-red-800",
      dot: "bg-red-600",
      export: { bg: "#DC2626", border: "#B91C1C", fg: "#ffffff" },
    },
  };

  return (
    <div className="border-b border-black">
      <div className="bg-[#003B5C] px-3 py-2 text-sm font-bold text-white">
        Project Summary — Assessment of the project H&amp;S status
      </div>
      <div className="grid gap-4 px-3 py-4 sm:grid-cols-[220px_minmax(0,1fr)]">
        <div className="flex flex-col gap-2">
          {HS_STATUS.map((s) => {
            const on = status === s;
            const styles = statusStyles[s];
            return (
              <button
                key={s}
                type="button"
                disabled={!editable || !onChange}
                data-hs-status={s}
                data-hs-selected={on ? "true" : "false"}
                onClick={() => onChange?.("hsStatus", s)}
                className={cn(
                  "inline-flex items-center gap-2 rounded-full border-2 px-3 py-2 text-left text-sm font-bold transition-colors",
                  on ? styles.selected : styles.unselected,
                )}
                style={
                  on
                    ? {
                        backgroundColor: styles.export.bg,
                        borderColor: styles.export.border,
                        color: styles.export.fg,
                      }
                    : undefined
                }
              >
                <span
                  className={cn(
                    "size-2.5 shrink-0 rounded-full",
                    on ? "bg-white" : styles.dot,
                  )}
                />
                {s}
              </button>
            );
          })}
        </div>
        <div className="grid gap-2 content-start">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-600">
            Notify / copy to
          </p>
          {NOTIFY.map((role) => (
            <label key={role} className="flex items-center gap-2 text-sm text-neutral-800">
              <input
                type="checkbox"
                className="size-3.5 accent-[#003B5C]"
                disabled={!editable || !onChange}
                checked={selected.has(role)}
                onChange={() => {
                  if (!onChange) return;
                  const next = new Set(selected);
                  if (next.has(role)) next.delete(role);
                  else next.add(role);
                  onChange("notifyRoles", Array.from(next).join("|"));
                }}
              />
              {role}
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

function ScoreLegend() {
  return (
    <div className="border-b border-black bg-[#FFF8E7] px-2 py-2 text-center text-xs font-semibold text-neutral-800">
      1 Non-compliant · 2 Partial · 3 Full Compliance · N/A · NIU
    </div>
  );
}

function SectionPhotos({
  sectionCode,
  values,
  onChange,
  editable,
}: DocumentFormBindings & { sectionCode: string }) {
  const galleryRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const key = photoKey(sectionCode);
  const photos = parsePhotos(values?.[key]);
  // One photo per section — keep only the latest / first for display & save.
  const photo = photos[0] ?? "";

  function persist(url: string | null) {
    onChange?.(key, url ? JSON.stringify([url]) : "[]");
  }

  async function onFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !onChange) return;
    try {
      const { url, uploaded } = await uploadFileToCloudinary(file, {
        folder: "sheq-harmony/sheq-forms",
        resourceType: "image",
        acceptImageOnly: true,
        maxBytes: 2_000_000,
      });
      persist(url);
      if (uploaded) toast.success("Photo saved");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Unable to upload image");
    } finally {
      e.target.value = "";
    }
  }

  if (!photo && !editable) return null;

  return (
    <div className="border-t border-black px-3 py-3" data-export-break>
      <p className="mb-2 text-sm font-bold uppercase tracking-wide text-neutral-900">
        Section photo
      </p>
      {photo ? (
        <div className="relative inline-block max-w-full">
          <img
            src={photo}
            alt={`Section ${sectionCode} photo`}
            className="max-h-48 max-w-full rounded border border-black object-contain bg-white"
          />
          {editable && onChange ? (
            <div className="pdf-hide mt-2 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded border border-black bg-amber-50/60 px-2.5 py-1.5 text-xs font-semibold"
              >
                <ImagePlus className="size-3.5" />
                Replace
              </button>
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                className="inline-flex items-center gap-1.5 rounded border border-black bg-amber-50/60 px-2.5 py-1.5 text-xs font-semibold"
              >
                <Camera className="size-3.5" />
                Retake photo
              </button>
              <button
                type="button"
                onClick={() => persist(null)}
                className="inline-flex items-center gap-1.5 rounded border border-black bg-white px-2.5 py-1.5 text-xs font-semibold text-red-700"
                aria-label="Remove photo"
              >
                <Trash2 className="size-3.5" />
                Remove
              </button>
            </div>
          ) : null}
        </div>
      ) : editable && onChange ? (
        <div className="pdf-hide flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => galleryRef.current?.click()}
            className="flex h-24 w-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-black bg-amber-50/40 text-neutral-700 hover:bg-amber-50"
          >
            <ImagePlus className="size-5" />
            <span className="text-[10px] font-semibold uppercase">Upload</span>
          </button>
          <button
            type="button"
            onClick={() => cameraRef.current?.click()}
            className="flex h-24 w-28 flex-col items-center justify-center gap-1 rounded border border-dashed border-black bg-amber-50/40 text-neutral-700 hover:bg-amber-50"
          >
            <Camera className="size-5" />
            <span className="text-[10px] font-semibold uppercase">Take photo</span>
          </button>
        </div>
      ) : null}
      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void onFile(e)}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void onFile(e)}
      />
    </div>
  );
}

function QuestionSections({
  sections,
  values,
  onChange,
  editable,
}: DocumentFormBindings & { sections: Section[] }) {
  return (
    <div className="sheq-question-tables">
      <ScoreLegend />
      {sections.map((section) => {
        const totals = sectionTotals(section, values);
        return (
          <div key={section.code} className="border-b border-black" data-export-break>
            <table className="w-full border-collapse table-fixed">
              <colgroup>
                <col style={{ width: "42%" }} />
                <col style={{ width: "96px" }} />
                <col />
              </colgroup>
              <thead>
                <tr data-export-break>
                  <th
                    colSpan={3}
                    className="border border-black bg-[#DCEAF3] px-3 py-2 text-left text-sm font-bold uppercase tracking-wide text-neutral-900"
                  >
                    {section.title}
                  </th>
                </tr>
                <tr data-export-break className="bg-[#003B5C] text-[11px] font-bold uppercase tracking-wide text-white">
                  <th className="border border-black px-2 py-2 text-left font-bold">Item</th>
                  <th className="border border-black px-2 py-2 text-center font-bold">Score</th>
                  <th className="border border-black px-2 py-2 text-left font-bold">Comments</th>
                </tr>
              </thead>
              <tbody>
                {section.subsections.map((sub) => (
                  <Fragment key={sub.code}>
                    <tr data-export-break>
                      <td
                        colSpan={3}
                        className="border border-black bg-[#003B5C] px-3 py-1.5 text-[12px] font-bold uppercase tracking-wide text-white"
                      >
                        {sub.title}
                      </td>
                    </tr>
                    {sub.questions.map((q, idx) => {
                      const scoreField = qKey(section.code, sub.code, q.id, "score");
                      const commentField = qKey(section.code, sub.code, q.id, "comment");
                      const score = values?.[scoreField] ?? "";
                      const isNc = score === "1";
                      return (
                        <tr
                          key={q.id}
                          data-export-break
                          className={cn(
                            isNc ? "bg-red-50" : idx % 2 === 1 ? "bg-neutral-50" : "bg-white",
                          )}
                        >
                          <td className="border border-black px-3 py-2 align-top text-sm font-medium text-neutral-800">
                            {q.label}
                            {isNc ? (
                              <span className="ml-2 inline-block rounded bg-[#9A3412] px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">
                                NC
                              </span>
                            ) : null}
                          </td>
                          <td
                            className={cn(
                              "border border-black px-1 py-1 align-middle text-center",
                              isNc ? "bg-red-100" : "bg-[#EEF5F9]",
                            )}
                          >
                            {editable && onChange ? (
                              <select
                                className={cn(
                                  "h-9 w-full rounded border border-black px-1 text-center text-sm font-semibold outline-none focus:ring-1 focus:ring-neutral-400",
                                  isNc ? "bg-red-200 text-red-950" : "bg-white",
                                )}
                                value={score}
                                onChange={(e) => onChange(scoreField, e.target.value)}
                                aria-label={`${q.label} score`}
                              >
                                <option value="">—</option>
                                {SCORE_OPTIONS.map((opt) => (
                                  <option key={opt} value={opt}>
                                    {opt === "1" ? "1 (Nonconformance)" : opt}
                                  </option>
                                ))}
                              </select>
                            ) : (
                              <div
                                className={cn(
                                  "grid min-h-9 place-items-center text-sm font-semibold",
                                  isNc && "text-red-900",
                                )}
                              >
                                {score || "—"}
                              </div>
                            )}
                          </td>
                          <td className="border border-black align-top">
                            {editable && onChange ? (
                              <textarea
                                className="min-h-9 w-full resize-y bg-amber-50/40 px-2 py-2 text-sm outline-none ring-inset focus:ring-1 focus:ring-neutral-400"
                                value={values?.[commentField] ?? ""}
                                placeholder="Comments"
                                onChange={(e) => onChange(commentField, e.target.value)}
                              />
                            ) : (
                              <div className="min-h-9 whitespace-pre-wrap px-2 py-2 text-sm text-neutral-700">
                                {values?.[commentField] || "\u00a0"}
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </Fragment>
                ))}
                <tr data-export-break className="bg-[#D7EEF7] text-sm font-bold text-[#003B5C]">
                  <td className="border border-black px-3 py-2.5 text-right uppercase tracking-wide">
                    Total score
                  </td>
                  <td className="border border-black bg-[#C5E6F3] px-2 py-2.5 text-center tabular-nums">
                    {totals.score} / {totals.max}
                  </td>
                  <td className="border border-black bg-[#A9DCF0]" />
                </tr>
              </tbody>
            </table>
            <SectionPhotos
              sectionCode={section.code}
              values={values}
              onChange={onChange}
              editable={editable}
            />
          </div>
        );
      })}
    </div>
  );
}

function pctOf(score: number, max: number) {
  if (max <= 0) return 0;
  return Math.round((score / max) * 100);
}

function complianceTone(pct: number) {
  if (pct >= 85) return { label: "Good", color: "#15803D", bg: "#DCFCE7" };
  if (pct >= 60) return { label: "Fair", color: "#A16207", bg: "#FEF3C7" };
  return { label: "Poor", color: "#B91C1C", bg: "#FEE2E2" };
}

function scoreDistribution(sections: Section[], values?: Record<string, string>) {
  const counts = { "1": 0, "2": 0, "3": 0, "N/A": 0, NIU: 0, blank: 0 };
  for (const section of sections) {
    for (const sub of section.subsections) {
      for (const q of sub.questions) {
        const raw = values?.[qKey(section.code, sub.code, q.id, "score")] ?? "";
        if (raw === "1" || raw === "2" || raw === "3" || raw === "N/A" || raw === "NIU") {
          counts[raw] += 1;
        } else {
          counts.blank += 1;
        }
      }
    }
  }
  return counts;
}

export type SheqComplianceSummary = {
  score: number;
  max: number;
  percent: number;
  /** Mean score of answered 1/2/3 items (0–3). */
  averageScore: number;
  answeredCount: number;
  ncCount: number;
  sections: { code: string; title: string; score: number; max: number; percent: number }[];
  distribution: ReturnType<typeof scoreDistribution>;
};

export function getSheqReportSections(kind?: string): Section[] | null {
  if (kind === "sheq-service-report") return SERVICE_SECTIONS;
  if (kind === "sheq-installation-report") return INSTALLATION_SECTIONS;
  return null;
}

export function computeSheqCompliance(
  sections: Section[],
  values?: Record<string, string>,
): SheqComplianceSummary {
  const totals = reportTotals(sections, values);
  const distribution = scoreDistribution(sections, values);
  const answeredCount =
    distribution["1"] + distribution["2"] + distribution["3"];
  const weighted =
    distribution["1"] * 1 + distribution["2"] * 2 + distribution["3"] * 3;
  const averageScore =
    answeredCount > 0
      ? Math.round((weighted / answeredCount) * 100) / 100
      : 0;
  return {
    score: totals.score,
    max: totals.max,
    percent: pctOf(totals.score, totals.max),
    averageScore,
    answeredCount,
    ncCount: distribution["1"],
    sections: sections.map((section) => {
      const t = sectionTotals(section, values);
      return {
        code: section.code,
        title: section.title,
        score: t.score,
        max: t.max,
        percent: pctOf(t.score, t.max),
      };
    }),
    distribution,
  };
}

export function computeSheqComplianceForKind(
  kind: string | undefined,
  values?: Record<string, string>,
): SheqComplianceSummary | null {
  const sections = getSheqReportSections(kind);
  if (!sections) return null;
  return computeSheqCompliance(sections, values);
}

function ComplianceRing({ percent }: { percent: number }) {
  const r = 36;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  const tone = complianceTone(percent);
  return (
    <svg viewBox="0 0 100 100" width={112} height={112} className="shrink-0">
      <circle cx="50" cy="50" r={r} fill="none" stroke="#E5E7EB" strokeWidth="10" />
      <circle
        cx="50"
        cy="50"
        r={r}
        fill="none"
        stroke={tone.color}
        strokeWidth="10"
        strokeDasharray={`${c} ${c}`}
        strokeDashoffset={offset}
        strokeLinecap="round"
        transform="rotate(-90 50 50)"
      />
      <text
        x="50"
        y="46"
        textAnchor="middle"
        fontSize="20"
        fontWeight="700"
        fill={tone.color}
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        {percent}%
      </text>
      <text
        x="50"
        y="62"
        textAnchor="middle"
        fontSize="8"
        fontWeight="600"
        fill="#525252"
        fontFamily="ui-sans-serif, system-ui, sans-serif"
      >
        COMPLIANCE
      </text>
    </svg>
  );
}

function DistBar({
  label,
  count,
  total,
  color,
}: {
  label: string;
  count: number;
  total: number;
  color: string;
}) {
  const width = total > 0 ? Math.max(count > 0 ? 6 : 0, (count / total) * 100) : 0;
  return (
    <div className="grid grid-cols-[88px_minmax(0,1fr)_40px] items-center gap-2 text-xs">
      <span className="font-semibold text-neutral-700">{label}</span>
      <div
        className="h-4 overflow-hidden rounded-sm border border-black/10 bg-neutral-100"
        data-dist-track="true"
      >
        <div
          className="h-full rounded-sm"
          data-dist-fill="true"
          style={{
            width: `${width}%`,
            minWidth: count > 0 ? "6px" : "0",
            backgroundColor: color,
          }}
        />
      </div>
      <span className="text-right tabular-nums font-semibold text-neutral-800">
        {count}
      </span>
    </div>
  );
}

function ComplianceDashboard({
  sections,
  values,
}: DocumentFormBindings & { sections: Section[] }) {
  const summary = computeSheqCompliance(sections, values);
  const tone = complianceTone(summary.percent);
  // Bars relative to answered scores only (exclude blanks so widths render properly).
  const scoredAnswered =
    summary.distribution["1"] +
    summary.distribution["2"] +
    summary.distribution["3"] +
    summary.distribution["N/A"] +
    summary.distribution.NIU;
  const avgLabel =
    summary.answeredCount > 0
      ? `${summary.averageScore.toFixed(2)} / 3`
      : "—";

  return (
    <div
      className="border-b border-black bg-white"
      data-sheq-compliance-dashboard
    >
      {/* Keep the summary (ring + metrics + distribution) as one PDF unit. */}
      <div data-export-break data-export-keep-together>
        <div className="bg-[#003B5C] px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white">
          Compliance dashboard
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-4 border-x border-black p-4">
          <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-black/10 bg-[#F8FAFC] px-4 py-3">
            <ComplianceRing percent={summary.percent} />
            <div
              className="rounded px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide"
              style={{ backgroundColor: tone.bg, color: tone.color }}
            >
              {tone.label}
            </div>
            <p className="text-center text-xs text-neutral-600">
              Score{" "}
              <span className="font-bold tabular-nums text-neutral-900">
                {summary.score} / {summary.max || "—"}
              </span>
            </p>
            <p className="text-center text-xs text-neutral-600">
              Avg score{" "}
              <span className="font-bold tabular-nums text-neutral-900">{avgLabel}</span>
            </p>
          </div>

          <div className="grid gap-4">
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              {(
                [
                  ["Compliance", `${summary.percent}%`],
                  ["Avg score", avgLabel],
                  ["Points", `${summary.score}/${summary.max || 0}`],
                  ["Nonconformances", String(summary.ncCount)],
                  ["Unanswered", String(summary.distribution.blank)],
                ] as const
              ).map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-md border border-black/15 bg-[#F1F5F9] px-3 py-2 text-center"
                >
                  <div className="text-[10px] font-bold uppercase tracking-wide text-neutral-500">
                    {label}
                  </div>
                  <div className="mt-0.5 text-lg font-bold tabular-nums text-[#003B5C]">
                    {value}
                  </div>
                </div>
              ))}
            </div>

            <div>
              <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#003B5C]">
                Score distribution
              </div>
              <div className="grid gap-2">
                <DistBar
                  label="3 Full"
                  count={summary.distribution["3"]}
                  total={scoredAnswered}
                  color="#15803D"
                />
                <DistBar
                  label="2 Partial"
                  count={summary.distribution["2"]}
                  total={scoredAnswered}
                  color="#CA8A04"
                />
                <DistBar
                  label="1 NC"
                  count={summary.distribution["1"]}
                  total={scoredAnswered}
                  color="#B91C1C"
                />
                <DistBar
                  label="N/A"
                  count={summary.distribution["N/A"]}
                  total={scoredAnswered}
                  color="#64748B"
                />
                <DistBar
                  label="NIU"
                  count={summary.distribution.NIU}
                  total={scoredAnswered}
                  color="#94A3B8"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="border-x border-black border-t border-black/20 px-4 py-3">
        <div
          className="mb-2 text-[11px] font-bold uppercase tracking-wide text-[#003B5C]"
          data-export-break
        >
          Section compliance
        </div>
        <div className="grid gap-2.5">
          {summary.sections.map((section) => {
            const sectionTone = complianceTone(section.percent);
            const width = section.max > 0 ? section.percent : 0;
            return (
              <div
                key={section.code}
                data-export-break
                className="grid grid-cols-[minmax(0,1.4fr)_minmax(0,2fr)_52px] items-center gap-2 text-xs"
              >
                <span className="truncate font-medium text-neutral-800">
                  {section.title}
                </span>
                <div
                  className="h-4 overflow-hidden rounded-sm border border-black/10 bg-neutral-100"
                  data-dist-track="true"
                >
                  <div
                    className="h-full"
                    data-dist-fill="true"
                    style={{
                      width: `${width}%`,
                      minWidth: width > 0 ? "6px" : "0",
                      backgroundColor: section.max > 0 ? sectionTone.color : "#CBD5E1",
                    }}
                  />
                </div>
                <span
                  className="text-right tabular-nums font-bold"
                  style={{ color: section.max > 0 ? sectionTone.color : "#64748B" }}
                >
                  {section.max > 0 ? `${section.percent}%` : "—"}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function OverallTotal({
  sections,
  values,
}: DocumentFormBindings & { sections: Section[] }) {
  const totals = reportTotals(sections, values);
  const percent = pctOf(totals.score, totals.max);
  const tone = complianceTone(percent);
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-black bg-[#E8F1F7] px-3 py-3 text-sm font-bold text-[#003B5C]">
      <span className="uppercase tracking-wide">Overall total score</span>
      <span className="flex flex-wrap items-center gap-3 tabular-nums text-base">
        <span>
          {totals.score} / {totals.max || "—"}
        </span>
        {totals.max > 0 ? (
          <span
            className="rounded px-2 py-0.5 text-sm"
            style={{ backgroundColor: tone.bg, color: tone.color }}
          >
            {percent}%
          </span>
        ) : null}
      </span>
    </div>
  );
}

const NC_HEADER = "#9A3412";
const NC_COL_BG = "#F5F0E8";
const NC_COL_TEXT = "#9A3412";

function NcCell({
  fieldKey,
  values,
  onChange,
  editable,
  placeholder,
  type = "text",
}: {
  fieldKey: string;
  values?: Record<string, string>;
  onChange?: (key: string, value: string) => void;
  editable?: boolean;
  placeholder: string;
  type?: "text" | "date";
}) {
  const value = values?.[fieldKey] ?? "";
  if (editable && onChange) {
    if (type === "date") {
      return (
        <input
          type="date"
          className="min-h-10 w-full bg-transparent px-2 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-[#9A3412]/40"
          value={value}
          onChange={(e) => onChange(fieldKey, e.target.value)}
          aria-label={placeholder}
        />
      );
    }
    return (
      <textarea
        className="min-h-10 w-full resize-y bg-transparent px-2 py-2 text-sm outline-none focus:bg-white focus:ring-1 focus:ring-[#9A3412]/40"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        aria-label={placeholder}
      />
    );
  }
  return (
    <div className="min-h-10 whitespace-pre-wrap px-2 py-2 text-sm text-neutral-800">
      {value || "\u00a0"}
    </div>
  );
}

function NonconformanceFindings({
  sections,
  values,
  onChange,
  editable,
}: DocumentFormBindings & { sections: Section[] }) {
  const findings = listNonconformances(sections, values);
  if (findings.length === 0) return null;

  return (
    <div className="border-b border-black" data-export-break>
      <div
        className="px-3 py-2.5 text-sm font-bold uppercase tracking-wide text-white"
        style={{ backgroundColor: NC_HEADER }}
      >
        Nonconformance findings
      </div>
      <p className="border-x border-black bg-[#FFF8F1] px-3 py-2 text-xs text-neutral-700">
        Score <strong>1</strong> marks a nonconformance. Complete every field below for each
        finding before submitting.
      </p>
      <table className="w-full border-collapse table-fixed">
        <colgroup>
          <col style={{ width: "22%" }} />
          <col style={{ width: "26%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "18%" }} />
          <col style={{ width: "16%" }} />
        </colgroup>
        <thead>
          <tr data-export-break style={{ backgroundColor: NC_COL_BG, color: NC_COL_TEXT }}>
            {(
              [
                "Item",
                "Remedial action",
                "Timing to complete action",
                "Person responsible",
                "Date closed",
              ] as const
            ).map((label) => (
              <th
                key={label}
                className="border border-black px-2 py-2 text-center text-[11px] font-bold uppercase tracking-wide"
              >
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {findings.map((row) => (
            <tr key={row.key} data-export-break className="bg-white">
              <td className="border border-black px-2 py-2 align-top text-sm font-medium text-neutral-900">
                {row.item}
              </td>
              <td className="border border-black align-top">
                <NcCell
                  fieldKey={row.actionKey}
                  values={values}
                  onChange={onChange}
                  editable={editable}
                  placeholder="Describe remedial action *"
                />
              </td>
              <td className="border border-black align-top">
                <NcCell
                  fieldKey={row.timingKey}
                  values={values}
                  onChange={onChange}
                  editable={editable}
                  placeholder="e.g. Within 7 days *"
                />
              </td>
              <td className="border border-black align-top">
                <NcCell
                  fieldKey={row.personKey}
                  values={values}
                  onChange={onChange}
                  editable={editable}
                  placeholder="Name / role *"
                />
              </td>
              <td className="border border-black align-top">
                <NcCell
                  fieldKey={row.closedKey}
                  values={values}
                  onChange={onChange}
                  editable={editable}
                  placeholder="Date closed"
                  type="date"
                />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SheqReportShell({
  template,
  bannerTitle,
  sections,
  values,
  onChange,
  editable,
  children,
}: Props & { children?: ReactNode }) {
  const bind = { values, onChange, editable };
  return (
    <DocumentChrome
      className="sheq-scored-report-doc"
      meta={{
        title: bannerTitle,
        documentNo: values?.documentNo || template.documentNo || template.code || "",
        approvedBy: values?.approvedBy || template.approvedBy || "Management",
        dateLabel: values?.date || "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <div className="border-b border-black px-3 py-3 text-center text-base font-bold uppercase tracking-wide">
        {bannerTitle}
      </div>
      <HeaderGrid {...bind} />
      <ProjectSummary {...bind} />
      {/* Dashboard sits under header details and above scored questions (incl. PDF/Word). */}
      <ComplianceDashboard sections={sections} {...bind} />
      <QuestionSections sections={sections} {...bind} />
      <OverallTotal sections={sections} {...bind} />
      <NonconformanceFindings sections={sections} {...bind} />
      {children}
    </DocumentChrome>
  );
}

export function SheqServiceReportDocument({
  template,
  values,
  onChange,
  editable,
}: Omit<Props, "bannerTitle" | "sections">) {
  const bind = { values, onChange, editable };
  return (
    <SheqReportShell
      template={template}
      bannerTitle="SHEQ Service Report"
      sections={SERVICE_SECTIONS}
      {...bind}
    >
      <div className="border-b border-black" data-export-break data-export-keep-together>
        <div className="bg-neutral-100 px-3 py-2 text-sm font-semibold">
          Inspection notes &amp; findings
        </div>
        <FieldRow label="Scope of works" fieldKey="scopeOfWorks" wide {...bind} />
        <FieldRow label="Findings" fieldKey="findings" wide {...bind} />
        <FieldRow
          label="Corrective actions / recommendations"
          fieldKey="correctiveActions"
          wide
          {...bind}
        />
        <FieldRow label="Additional comments" fieldKey="comments" wide {...bind} />
      </div>
    </SheqReportShell>
  );
}

export function SheqInstallationReportDocument({
  template,
  values,
  onChange,
  editable,
}: Omit<Props, "bannerTitle" | "sections">) {
  const bind = { values, onChange, editable };
  return (
    <SheqReportShell
      template={template}
      bannerTitle="SHEQ Installation Service Report"
      sections={INSTALLATION_SECTIONS}
      {...bind}
    >
      <div className="border-b border-black" data-export-break>
        <div className="bg-neutral-100 px-3 py-2 text-sm font-semibold">
          Installation details
        </div>
        <FieldRow label="Lift / unit reference" fieldKey="unitReference" {...bind} />
        <FieldRow label="Installation stage" fieldKey="installationStage" {...bind} />
        <FieldRow label="Works completed" fieldKey="worksCompleted" wide {...bind} />
        <FieldRow label="Outstanding works" fieldKey="outstandingWorks" wide {...bind} />
        <FieldRow
          label="Safety observations"
          fieldKey="safetyObservations"
          wide
          {...bind}
        />
        <FieldRow label="Handover / next steps" fieldKey="handoverNotes" wide {...bind} />
        <FieldRow label="Additional comments" fieldKey="comments" wide {...bind} />
      </div>
    </SheqReportShell>
  );
}
