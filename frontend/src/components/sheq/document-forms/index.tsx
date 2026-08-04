import type { ReactNode } from "react";
import type { Template } from "@/data/sheq";
import { SignaturePad } from "@/components/sheq/signature-pad";
import {
  DocumentChrome,
  EditableCheck,
  EditableValue,
  FieldRow,
  type DocumentFormBindings,
} from "./chrome";
import {
  GoodPracticeDocument,
  OhsConcernDocument,
  QualityConcernDocument,
  SustainabilityConcernDocument,
} from "./ohs-concern";
import {
  SheqInstallationReportDocument,
  SheqServiceReportDocument,
} from "./sheq-service-forms";
import { AlimakWeeklyCheckDocument } from "./alimak-weekly-check";
import { cn } from "@/lib/utils";

type DocProps = { template: Template } & DocumentFormBindings;

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <div className="border-b border-black bg-neutral-100 px-3 py-2 text-sm font-semibold">
      {children}
    </div>
  );
}

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="border-b border-black px-3 py-3 text-sm leading-relaxed text-neutral-800">
      {children}
    </p>
  );
}

function CheckGrid({
  items,
  fieldPrefix = "check",
  values,
  onChange,
  editable,
}: { items: string[]; fieldPrefix?: string } & DocumentFormBindings) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-black px-3 py-3 sm:grid-cols-4">
      {items.map((item, i) => (
        <EditableCheck
          key={item}
          fieldKey={`${fieldPrefix}_${i}`}
          label={item}
          values={values}
          onChange={onChange}
          editable={editable}
          className="items-center"
        />
      ))}
    </div>
  );
}

const SAFE_START_HAZARDS: { label: string; src: string; alt: string }[] = [
  {
    label: "Work at Height",
    src: "/templates/safe-start/work-at-height.jpeg",
    alt: "Work at height",
  },
  {
    label: "Manual Lifting",
    src: "/templates/safe-start/manual-lifting.png",
    alt: "Manual lifting",
  },
  {
    label: "Lifting Operation",
    src: "/templates/safe-start/lifting-operation.jpeg",
    alt: "Chain hoists and lifting equipment",
  },
  {
    label: "Power Tools & Equipment",
    src: "/templates/safe-start/power-tools.jpeg",
    alt: "Power tools",
  },
  {
    label: "Open Lift Shaft",
    src: "/templates/safe-start/open-lift-shaft.png",
    alt: "Elevator shaft danger",
  },
  {
    label: "Electricity",
    src: "/templates/safe-start/electricity.png",
    alt: "Electric shock risk",
  },
  {
    label: "PPE / Health e.g. Dust / COSHH",
    src: "/templates/safe-start/ppe.jpeg",
    alt: "Personal protective equipment",
  },
];

function HazardImageGrid({ values, onChange, editable }: DocumentFormBindings) {
  const cells = [
    ...SAFE_START_HAZARDS.map((hazard, i) => ({
      key: hazard.label,
      image: (
        <img
          src={hazard.src}
          alt={hazard.alt}
          className="max-h-full max-w-full object-contain"
        />
      ),
      check: (
        <EditableCheck
          fieldKey={`hazard_${i}`}
          label={hazard.label}
          values={values}
          onChange={onChange}
          editable={editable}
          className="items-start px-1 py-1 text-[9px] leading-tight font-medium"
        />
      ),
    })),
    {
      key: "other",
      image: (
        <span className="px-1 text-center text-[9px] leading-tight text-neutral-500">
          List any other hazards below
        </span>
      ),
      check: (
        <EditableCheck
          fieldKey="hazard_other"
          label="Other (List)"
          values={values}
          onChange={onChange}
          editable={editable}
          className="items-start px-1 py-1 text-[9px] leading-tight font-medium"
        />
      ),
    },
  ];

  return (
    <div className="border-b border-black px-2 py-2">
      {/* Single-row table so fill UI and PDF keep all hazard images aligned. */}
      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            {cells.map((cell) => (
              <col key={cell.key} style={{ width: `${100 / cells.length}%` }} />
            ))}
          </colgroup>
          <tbody>
            <tr>
              {cells.map((cell) => (
                <td
                  key={`${cell.key}-img`}
                  className="border border-black bg-neutral-50 p-1 align-middle"
                >
                  <div className="flex h-16 items-center justify-center">{cell.image}</div>
                </td>
              ))}
            </tr>
            <tr>
              {cells.map((cell) => (
                <td
                  key={`${cell.key}-label`}
                  className="border border-black bg-white p-0 align-top"
                >
                  {cell.check}
                </td>
              ))}
            </tr>
          </tbody>
        </table>
      </div>
      <div className="mt-2">
        <EditableValue
          fieldKey="otherHazards"
          values={values}
          onChange={onChange}
          editable={editable}
          multiline
          placeholder="Other hazards:"
          className="min-h-12 rounded-md border border-dashed border-black"
        />
      </div>
    </div>
  );
}

function ScoreRow({
  label,
  fieldKey,
  values,
  onChange,
  editable,
}: { label: string; fieldKey: string } & DocumentFormBindings) {
  return (
    <div className="grid grid-cols-[minmax(0,1.4fr)_110px_minmax(0,1fr)] border-t border-black text-sm">
      <div className="border-r border-black px-2 py-2">{label}</div>
      <div className="border-r border-black">
        <EditableValue
          fieldKey={`${fieldKey}_compliant`}
          values={values}
          onChange={onChange}
          editable={editable}
          placeholder="Y / N / NA"
          className="min-h-10 text-center"
        />
      </div>
      <EditableValue
        fieldKey={`${fieldKey}_comments`}
        values={values}
        onChange={onChange}
        editable={editable}
        className="min-h-10"
      />
    </div>
  );
}

function DrawSignatureCell({
  fieldKey,
  label,
  values,
  onChange,
  editable,
  height = 48,
}: { fieldKey: string; label: string; height?: number } & DocumentFormBindings) {
  const value = values?.[fieldKey] || "";
  const isDrawn = value.startsWith("data:image");

  // Keep typed text from older saves visible in view/download; use pad when editing or drawn.
  if (!editable && value && !isDrawn) {
    return <EditableValue fieldKey={fieldKey} values={values} editable={false} className="min-h-12" />;
  }

  if (editable && onChange) {
    return (
      <SignaturePad
        value={isDrawn ? value : ""}
        height={height}
        label={label}
        className="bg-amber-50/40"
        onChange={(v) => onChange(fieldKey, v)}
      />
    );
  }

  return (
    <SignaturePad
      value={isDrawn ? value : ""}
      readOnly
      height={height}
      label={label}
      className="bg-white"
    />
  );
}

export function RamsBriefingDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };
  const subtitle =
    values?.subtitle ||
    "Risk Assessment & Method Statement (RAMS) Briefing Form";

  return (
    <DocumentChrome
      meta={{
        title: "RAMS Briefing Register",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <div className="border-b border-black p-0 text-center text-sm font-semibold">
        {editable && onChange ? (
          <input
            className="w-full bg-amber-50/40 px-3 py-2 text-center text-sm font-semibold outline-none ring-inset focus:ring-1 focus:ring-neutral-400"
            value={subtitle}
            placeholder="Risk Assessment & Method Statement (RAMS) Briefing Form"
            onChange={(e) => onChange("subtitle", e.target.value)}
          />
        ) : (
          <div className="px-3 py-2">{subtitle}</div>
        )}
      </div>

      <table className="w-full border-collapse text-sm">
        <tbody>
          {(
            [
              ["Name of Person conducting Briefing", "briefingPerson"],
              ["Job Title", "briefingJobTitle"],
              ["Project Name / Title", "projectName"],
              ["Name of Principal Contractor", "principalContractor"],
            ] as const
          ).map(([label, key]) => (
            <tr key={key}>
              <th className="w-[220px] border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
                {label}
              </th>
              <td className="border border-black p-0">
                <EditableValue fieldKey={key} {...bind} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Note>
        I confirm that I have read and understand the requirements of this method statement and
        associated risk assessments and have communicated them to operatives / persons under my
        control and to those who may be affected by it.
      </Note>

      <table className="w-full border-collapse text-sm">
        <tbody>
          {(
            [
              ["Name of Inductee", "inducteeName"],
              ["Job Title", "inducteeJobTitle"],
            ] as const
          ).map(([label, key]) => (
            <tr key={key}>
              <th className="w-[220px] border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
                {label}
              </th>
              <td className="border border-black p-0">
                <EditableValue fieldKey={key} {...bind} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <Note>
        I hereby confirm that I have received, read and fully understood the approved site Risk
        Assessment & Method Statement (RAMS) and sign to say that I fully agree to adhere to the
        contents of the method statement(s) and associated risk assessments.
      </Note>

      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-neutral-200 text-left font-semibold">
              <th className="border border-black px-2 py-2">Document Title</th>
              <th className="w-[110px] border border-black px-2 py-2">Date</th>
              <th className="min-w-[160px] border border-black px-2 py-2">
                Signature of Inductee
              </th>
              <th className="min-w-[160px] border border-black px-2 py-2">
                Signature of Inductor
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i} className="align-middle">
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`rams_row_${i}_document_title`}
                    {...bind}
                    className="min-h-12"
                  />
                </td>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`rams_row_${i}_date`}
                    {...bind}
                    className="min-h-12"
                  />
                </td>
                <td className="border border-black p-0">
                  <DrawSignatureCell
                    fieldKey={`rams_row_${i}_signature_of_inductee`}
                    label={`Inductee signature ${i + 1}`}
                    {...bind}
                  />
                </td>
                <td className="border border-black p-0">
                  <DrawSignatureCell
                    fieldKey={`rams_row_${i}_signature_of_inductor`}
                    label={`Inductor signature ${i + 1}`}
                    {...bind}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DocumentChrome>
  );
}

export function SafeStartDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };

  return (
    <DocumentChrome
      className="safe-start-doc"
      meta={{
        title: "Daily Safe Start Briefing Sheet",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        // Logos come from form values / uploads only — no baked-in company logo.
        logoLeft: undefined,
        logoRight: undefined,
      }}
      {...bind}
    >
      <div className="border-b border-black bg-neutral-100 px-3 py-2 text-center text-sm font-bold">
        Start Right Daily Safety Briefing
      </div>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <th className="w-[140px] border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Project name
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="projectName" {...bind} />
            </td>
            <th className="w-[80px] border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Date
            </th>
            <td className="w-[180px] border border-black p-0">
              <EditableValue fieldKey="briefingDate" {...bind} />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Principal Contractor
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="principalContractor" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Method Statement No.
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="methodStatementNo" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <Note>
        All personnel are to receive a daily safety briefing (relating to RAMS scope of work for the
        day) before they START work on site. This requirement applies to employees, sub-contractors
        and any other person prior to starting work for or on behalf of Focus Lifts each day.
      </Note>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Key activities: (details of the RAMS work activity)
            </th>
          </tr>
          <tr>
            <td className="border border-black p-0">
              <EditableValue fieldKey="keyActivities" {...bind} multiline className="min-h-16" />
            </td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>
        Key hazards associated with the task (tick where applicable)
      </SectionTitle>
      <HazardImageGrid {...bind} />

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black px-2 py-2">
              Are the current method statements, risk assessments and Lift Plan in place?
            </td>
            <td className="w-[120px] border border-black p-0">
              <EditableValue fieldKey="ramsInPlace" {...bind} placeholder="Y / N" />
            </td>
          </tr>
          <tr>
            <th
              colSpan={2}
              className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium"
            >
              Key control measures to be followed
            </th>
          </tr>
          <tr>
            <td colSpan={2} className="border border-black p-0">
              <EditableValue fieldKey="controlMeasures" {...bind} multiline className="min-h-16" />
            </td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>Attendance record</SectionTitle>
      <Note>
        I acknowledge receipt of the daily task briefing detailed above and confirm that I have been
        briefed on the risk assessments and method statement for the task.
      </Note>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col className="w-[44px]" />
            <col className="w-[28%]" />
            <col className="w-[32%]" />
            <col />
          </colgroup>
          <thead>
            <tr className="bg-neutral-200 text-left font-semibold">
              <th className="border border-black px-2 py-2 text-center">#</th>
              <th className="border border-black px-2 py-2">Name</th>
              <th className="border border-black px-2 py-2">Signature</th>
              <th className="border border-black px-2 py-2">Comments</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 8 }, (_, i) => (
              <tr key={i} className="align-middle">
                <td className="border border-black px-2 py-2 text-center text-neutral-600">
                  {i + 1}
                </td>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`attendance_${i}_name`}
                    {...bind}
                    className="min-h-12"
                    placeholder="Name"
                  />
                </td>
                <td className="border border-black p-0">
                  <DrawSignatureCell
                    fieldKey={`attendance_${i}_signature`}
                    label={`Attendance signature ${i + 1}`}
                    {...bind}
                  />
                </td>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`attendance_${i}_comments`}
                    {...bind}
                    className="min-h-12"
                    placeholder="Comments"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <SectionTitle>
        Workforce Consultation (record any health & safety issues raised after briefing)
      </SectionTitle>
      <EditableValue
        fieldKey="consultation"
        {...bind}
        multiline
        className="border-b border-black"
      />

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[160px]" />
          <col />
          <col className="w-[28%]" />
          <col className="w-[22%]" />
        </colgroup>
        <tbody>
          <tr className="align-middle">
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Briefing given by
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="briefedBy" {...bind} placeholder="Name" />
            </td>
            <td className="border border-black p-0">
              <DrawSignatureCell
                fieldKey="briefedBySignature"
                label="Briefed by signature"
                height={52}
                {...bind}
              />
            </td>
            <td className="border border-black p-0">
              <EditableValue fieldKey="briefedByJobTitle" {...bind} placeholder="Job Title" />
            </td>
          </tr>
        </tbody>
      </table>
    </DocumentChrome>
  );
}

export function AuditActionDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };
  return (
    <DocumentChrome
      className="audit-action-doc"
      meta={{
        title: "Audit Action Form",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col />
          <col className="w-[100px]" />
          <col className="w-[160px]" />
        </colgroup>
        <tbody>
          <tr>
            <td className="border border-black bg-neutral-100 px-3 py-3 text-center text-base font-bold">
              ACTION FORM
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-3 text-left font-medium">
              Reference
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="reference" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Details of Observation
            </th>
          </tr>
          <tr>
            <td className="border border-black p-0">
              <EditableValue fieldKey="observation" {...bind} multiline className="min-h-16" />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[110px]" />
          <col />
          <col className="w-[110px]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Raised by
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="raisedBy" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Agreed with
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="agreedWith" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>PROPOSED / AGREED ACTION</SectionTitle>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black p-0">
              <EditableValue
                fieldKey="proposedAction"
                {...bind}
                multiline
                className="min-h-20"
                placeholder="Proposed / agreed action"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[110px]" />
          <col />
          <col className="w-[150px]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Agreed with
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="actionAgreedWith" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Date for Completion
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="completionDate" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>FOLLOW UP ACTION</SectionTitle>
      <Note>
        The agreed action has / has not been implemented and found to be effective.
      </Note>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[110px]" />
          <col />
          <col className="w-[90px]" />
          <col className="w-[32%]" />
        </colgroup>
        <tbody>
          <tr className="align-middle">
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Audited by
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="auditedBy" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Signature
            </th>
            <td className="border border-black p-0">
              <DrawSignatureCell
                fieldKey="auditorSignature"
                label="Auditor signature"
                height={56}
                {...bind}
              />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Date
            </th>
            <td colSpan={3} className="border border-black p-0">
              <EditableValue fieldKey="followUpDate" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>AUDIT SUMMARY</SectionTitle>
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[110px]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium align-top">
              Clause
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="clause" {...bind} multiline className="min-h-16" />
            </td>
          </tr>
        </tbody>
      </table>
    </DocumentChrome>
  );
}

export function PuwerDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };
  const inspectionCols = [
    { key: "date_of_inspection", label: "Date of Inspection", width: "12%" },
    { key: "description_of_plant", label: "Description of Plant", width: "18%" },
    { key: "id_no", label: "ID No.", width: "10%" },
    { key: "date_of_pat_inspection", label: "Date of PAT Inspection", width: "12%" },
    {
      key: "details",
      label: "Details of Inspection (defects identified and action taken)",
      width: "30%",
    },
    { key: "inspected_by", label: "Inspected by", width: "18%" },
  ] as const;

  return (
    <DocumentChrome
      className="puwer-doc"
      meta={{
        title: "PUWER Inspection",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[140px]" />
          <col />
          <col className="w-[140px]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Project Name
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="projectName" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Project Manager
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="projectManager" {...bind} />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Principal Contractor
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="principalContractor" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Site Supervisor
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="siteSupervisor" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          {inspectionCols.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
        </colgroup>
        <thead>
          <tr className="bg-neutral-200 text-left text-xs font-semibold">
            {inspectionCols.map((col) => (
              <th
                key={col.key}
                className="border border-black px-1.5 py-2 align-middle leading-snug"
              >
                {col.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 10 }, (_, i) => (
            <tr key={i} className="align-top">
              {inspectionCols.map((col) => (
                <td key={col.key} className="border border-black p-0">
                  <EditableValue
                    fieldKey={`puwer_row_${i}_${col.key}`}
                    {...bind}
                    className="min-h-10 text-xs"
                  />
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </DocumentChrome>
  );
}

export function LolerDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };
  const inspectionCols = [
    { key: "desc", label: "Equipment Description", width: "18%" },
    { key: "plantId", label: "Plant ID", width: "9%" },
    { key: "swl", label: "S.W.L LOLER", width: "9%" },
    { key: "nextExam", label: "Next Thorough Examination Date", width: "12%" },
    {
      key: "defects",
      label: "Matters giving rise to health or safety risk / defects",
      width: "22%",
    },
    { key: "action", label: "Details of action taken", width: "20%" },
  ] as const;

  return (
    <DocumentChrome
      className="loler-doc"
      meta={{
        title: "LOLER Inspection Form",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[140px]" />
          <col />
          <col className="w-[140px]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Project Name
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="projectName" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Project Manager
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="projectManager" {...bind} />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Principal Contractor
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="principalContractor" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Site Supervisor
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="siteSupervisor" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          {inspectionCols.map((col) => (
            <col key={col.key} style={{ width: col.width }} />
          ))}
          <col style={{ width: "10%" }} />
        </colgroup>
        <thead>
          <tr className="bg-neutral-200 text-left text-[11px] font-semibold leading-snug">
            {inspectionCols.map((col) => (
              <th
                key={col.key}
                className="border border-black px-1.5 py-2 align-middle"
              >
                {col.label}
              </th>
            ))}
            <th className="border border-black px-1.5 py-2 align-middle">
              Safe to use
            </th>
          </tr>
        </thead>
        <tbody>
          {Array.from({ length: 9 }, (_, i) => (
            <tr key={i} className="align-top">
              {inspectionCols.map((col) => (
                <td key={col.key} className="border border-black p-0">
                  <EditableValue
                    fieldKey={`loler_${i}_${col.key}`}
                    {...bind}
                    className="min-h-12 px-1.5 text-xs"
                  />
                </td>
              ))}
              <td className="border border-black px-1.5 py-1 align-middle">
                <div className="flex flex-col gap-1">
                  <EditableCheck
                    fieldKey={`loler_${i}_safe_yes`}
                    label="Yes"
                    {...bind}
                    className="items-center text-[10px]"
                  />
                  <EditableCheck
                    fieldKey={`loler_${i}_safe_no`}
                    label="No"
                    {...bind}
                    className="items-center text-[10px]"
                  />
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </DocumentChrome>
  );
}

const SHEQ_STANDARDS: { title: string; detail: string }[] = [
  {
    title: "ST 1 – Work at Heights: Scaffolding & Edge protection",
    detail:
      "(scaffold structure, fall protection, car top, voids, protection from falling objects)",
  },
  {
    title: "ST 2 – Lifting Operations & Manual Handling",
    detail:
      "(Guide rails, RAMS, Sling/Platform/Doors, Control Panel, Hydraulic Unit, Lift Car – lifting technique, lifting equipment)",
  },
  {
    title: "ST 3 – Temporary Access",
    detail:
      "(Hoardings, Scaffold towers, ladders, step & podium ladders, protecting others)",
  },
  {
    title: "ST 4 – Electricity",
    detail:
      "(Temp electrical power & lighting, permanent electrical supply, safe working with electricity, PAT)",
  },
  {
    title: "ST 5 – Accessing / Egressing & Working in the Pit",
    detail: "(entrance protection, ladder, pit hazards)",
  },
  {
    title: "ST 6 – Working in Lift Shaft / LMR",
    detail: "(access/egress, fall protection, housekeeping, lift equipment)",
  },
  {
    title: "ST 7 – Housekeeping & Welfare",
    detail:
      "(site housekeeping standards, storage area and lift equipment protection, site welfare)",
  },
  {
    title: "ST 8 – Personal Protective Equipment",
    detail: "(quality & compliance, risk based provision, task PPE)",
  },
  {
    title: "ST 9 – Project Planning Documentation",
    detail:
      "(Risk review process, method statements / risk assessment, key permits & completion of records)",
  },
  {
    title: "ST 10 – Supervision & Project Management",
    detail:
      "(Supervision, training & competence, team m/s briefing, toolbox talks, improvement plan review)",
  },
  {
    title: "ST 11 – Site Welfare",
    detail: "(Canteen, Toilets, Drying Room, First Aid, Fire etc.)",
  },
  {
    title: "ST 12 – Occupational Health",
    detail:
      "(COSHH, HAVs, Noise, Dust, Dermatitis, Weils, Drugs & Alcohol, Stress / Mental Health, Asbestos)",
  },
  {
    title: "ST 13 – Tools & Equipment",
    detail: "(Hand tools, Portable power tools, lighting, HAVs, Noise, Dust)",
  },
  {
    title: "ST 14 – Fire, Accident & Near Miss Reporting",
    detail:
      "(fire arrangements & procedures, escape procedures, first aid, accident reporting procedure, accident book, near miss cards)",
  },
  {
    title: "ST 15 – Environmental Management",
    detail:
      "(sustainability, pollution incident response, waste management, hazardous waste, nuisance)",
  },
  {
    title: "ST 16 – Quality Management",
    detail: "(Shaft survey, plumbing guiderails, plumbing doors, testing & commissioning)",
  },
  {
    title: "ST 17 – Hoardings",
    detail: "Hoardings installed securely, doors with locks & structurally robust",
  },
  {
    title: "ST 18 – Lift Motor Room",
    detail: "Safety signs, LOTO arrangements, oil resistant floors, safe working space etc.",
  },
  {
    title: "ST 19 – Lift Shaft & Pit",
    detail: "All fall risks protected, pits clean and free of water, oil, rubbish etc",
  },
  {
    title: "ST 20 – Site Requirements",
    detail:
      "Operatives following site requirements, policies and procedures including Hot Works Permits etc.",
  },
];

function StatusTick({
  fieldKey,
  values,
  onChange,
  editable,
  label,
}: { fieldKey: string; label?: string } & DocumentFormBindings) {
  const checked =
    (values?.[fieldKey] || "").toLowerCase() === "true" || values?.[fieldKey] === "1";

  if (editable && onChange) {
    return (
      <label className="inline-flex cursor-pointer items-center gap-1.5 text-sm">
        <input
          type="checkbox"
          className="size-3.5 accent-neutral-800"
          checked={checked}
          onChange={(e) => onChange(fieldKey, e.target.checked ? "true" : "")}
        />
        {label ? <span>{label}</span> : null}
      </label>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span
        className={cn(
          "inline-flex size-4 items-center justify-center border border-neutral-700 text-[11px] font-bold",
          checked && "bg-neutral-800 text-white",
        )}
      >
        {checked ? "✓" : ""}
      </span>
      {label ? <span>{label}</span> : null}
    </span>
  );
}

const SCORE_OPTIONS = [
  { value: "", label: "Select…" },
  { value: "A", label: "A – Good" },
  { value: "B", label: "B – Basic" },
  { value: "C", label: "C – Substandard" },
  { value: "NA", label: "N/A" },
] as const;

function scoreTone(value: string) {
  const v = value.toUpperCase();
  if (v === "A" || v === "Y") return "bg-green-100 text-green-900 border-green-600";
  if (v === "B") return "bg-yellow-100 text-yellow-950 border-yellow-600";
  if (v === "C" || v === "N") return "bg-red-100 text-red-900 border-red-600";
  if (v === "NA") return "bg-slate-100 text-slate-700 border-slate-400";
  return "bg-white text-neutral-700 border-black";
}

function CompliantScoreSelect({
  fieldKey,
  values,
  onChange,
  editable,
}: { fieldKey: string } & DocumentFormBindings) {
  const raw = values?.[fieldKey] || "";
  // Map older Y/N saves into the A/B/C scale for display.
  const value =
    raw.toUpperCase() === "Y" ? "A" : raw.toUpperCase() === "N" ? "C" : raw.toUpperCase();

  if (editable && onChange) {
    return (
      <select
        className={cn(
          "h-12 w-full cursor-pointer border-0 bg-transparent px-2 text-center text-sm font-semibold outline-none ring-inset focus:ring-1 focus:ring-neutral-400",
          scoreTone(value),
        )}
        value={["A", "B", "C", "NA"].includes(value) ? value : ""}
        onChange={(e) => onChange(fieldKey, e.target.value)}
        aria-label="Compliance score"
      >
        {SCORE_OPTIONS.map((opt) => (
          <option key={opt.value || "empty"} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    );
  }

  return (
    <div
      className={cn(
        "flex min-h-12 items-center justify-center border-0 px-2 text-sm font-bold",
        scoreTone(value),
      )}
    >
      {value || "\u00a0"}
    </div>
  );
}

export function SiteSheqDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };
  const hsStatus = (values?.hsStatus || "").toUpperCase();

  function setStatus(status: string) {
    if (!editable || !onChange) return;
    onChange("hsStatus", status);
    onChange("hsStatusGreenTick", status === "GREEN" ? "true" : "");
    onChange("hsStatusAmberTick", status === "AMBER" ? "true" : "");
    onChange("hsStatusRedTick", status === "RED" ? "true" : "");
  }

  return (
    <DocumentChrome
      className="site-sheq-doc"
      meta={{
        title: "Management Site Inspection Report",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <table className="w-full table-fixed border-collapse border border-black text-sm">
        <colgroup>
          <col className="w-[240px]" />
          <col />
        </colgroup>
        <tbody>
          {(
            [
              ["Name of Person conducting Inspection", "inspector"],
              ["Job Title", "inspectorJobTitle"],
              ["Project Name / Title", "projectName"],
              ["Name of Principal Contractor", "principalContractor"],
            ] as const
          ).map(([label, key]) => (
            <tr key={key}>
              <th className="border border-black bg-neutral-100 px-2 py-2 text-left font-medium text-neutral-900">
                {label}
              </th>
              <td className="border border-black p-0">
                <EditableValue fieldKey={key} {...bind} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      <SectionTitle>Scope of Inspection – Lift Installations</SectionTitle>

      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col />
          <col className="w-[56px]" />
          <col className="w-[200px]" />
          <col className="w-[56px]" />
        </colgroup>
        <thead>
          <tr>
            <th
              colSpan={2}
              className="border border-black bg-slate-700 px-2 py-2 text-left font-semibold text-white"
            >
              Project Summary – Based on this inspection the assessment of the project H&amp;S
              status is
            </th>
            <th className="border border-black bg-sky-800 px-2 py-2 text-left font-semibold text-white">
              Report Distribution
            </th>
            <th className="border border-black bg-sky-800 px-2 py-2 text-center font-semibold text-white">
              Tick
            </th>
          </tr>
        </thead>
        <tbody>
          <tr className="align-top">
            <td
              className={cn(
                "border border-black px-2 py-2",
                hsStatus === "GREEN" ? "bg-green-200" : "bg-green-50",
              )}
            >
              <button
                type="button"
                className={cn(
                  "w-full rounded-sm text-left",
                  editable && "cursor-pointer hover:bg-green-100",
                )}
                onClick={() => setStatus("GREEN")}
                disabled={!editable}
              >
                <span
                  className={cn(
                    "mr-2 inline-flex size-4 items-center justify-center border text-[11px] font-bold",
                    hsStatus === "GREEN"
                      ? "border-green-800 bg-green-700 text-white"
                      : "border-green-700 text-green-800",
                  )}
                >
                  {hsStatus === "GREEN" ? "✓" : ""}
                </span>
                <strong className="text-green-800">GREEN</strong>
                <span className="text-green-950">
                  {" "}
                  – PROJECT IN GOOD WELL MANAGED ORDER, WITH NO SIGNIFICANT STANDARDS ISSUES
                </span>
              </button>
            </td>
            <td
              className={cn(
                "border border-black px-2 py-2 text-center align-middle",
                hsStatus === "GREEN" ? "bg-green-200" : "bg-green-50",
              )}
            >
              <StatusTick fieldKey="hsStatusGreenTick" {...bind} />
            </td>
            <td className="border border-black bg-sky-50 px-2 py-2">Installation Director</td>
            <td className="border border-black bg-sky-50 px-2 py-2 text-center">
              <StatusTick fieldKey="dist_installation_director" {...bind} />
            </td>
          </tr>
          <tr className="align-top">
            <td
              rowSpan={2}
              className={cn(
                "border border-black px-2 py-2",
                hsStatus === "AMBER" ? "bg-yellow-200" : "bg-yellow-50",
              )}
            >
              <button
                type="button"
                className={cn(
                  "w-full rounded-sm text-left",
                  editable && "cursor-pointer hover:bg-yellow-100",
                )}
                onClick={() => setStatus("AMBER")}
                disabled={!editable}
              >
                <span
                  className={cn(
                    "mr-2 inline-flex size-4 items-center justify-center border text-[11px] font-bold",
                    hsStatus === "AMBER"
                      ? "border-yellow-800 bg-yellow-600 text-white"
                      : "border-yellow-700 text-yellow-900",
                  )}
                >
                  {hsStatus === "AMBER" ? "✓" : ""}
                </span>
                <strong className="text-yellow-900">AMBER *</strong>
                <span className="text-yellow-950">
                  {" "}
                  – SUPPORT REVIEW GIVES CAUSE FOR CONCERN, WITH SITE STANDARDS ISSUES REQUIRING
                  ATTENTION.
                </span>
                <div className="mt-1 text-xs font-normal text-yellow-900">
                  ACTION: Action plan produced after local review at site within 3 working days
                  (LEAD Project Manager with Project Supervisor)
                </div>
                <div className="mt-1 text-xs font-normal italic text-yellow-800">
                  * NB: CATEGORY TO BE APPLIED ONLY AFTER REVIEW WITH H&amp;S ADVISOR
                </div>
              </button>
            </td>
            <td
              rowSpan={2}
              className={cn(
                "border border-black px-2 py-2 text-center align-middle",
                hsStatus === "AMBER" ? "bg-yellow-200" : "bg-yellow-50",
              )}
            >
              <StatusTick fieldKey="hsStatusAmberTick" {...bind} />
            </td>
            <td className="border border-black bg-sky-50 px-2 py-2">SHEQ Advisor</td>
            <td className="border border-black bg-sky-50 px-2 py-2 text-center">
              <StatusTick fieldKey="dist_sheq_advisor" {...bind} />
            </td>
          </tr>
          <tr>
            <td className="border border-black bg-sky-50 px-2 py-2">Principal Contractor</td>
            <td className="border border-black bg-sky-50 px-2 py-2 text-center">
              <StatusTick fieldKey="dist_principal_contractor" {...bind} />
            </td>
          </tr>
          <tr className="align-top">
            <td
              className={cn(
                "border border-black px-2 py-2",
                hsStatus === "RED" ? "bg-red-200" : "bg-red-50",
              )}
            >
              <button
                type="button"
                className={cn(
                  "w-full rounded-sm text-left",
                  editable && "cursor-pointer hover:bg-red-100",
                )}
                onClick={() => setStatus("RED")}
                disabled={!editable}
              >
                <span
                  className={cn(
                    "mr-2 inline-flex size-4 items-center justify-center border text-[11px] font-bold",
                    hsStatus === "RED"
                      ? "border-red-900 bg-red-700 text-white"
                      : "border-red-700 text-red-800",
                  )}
                >
                  {hsStatus === "RED" ? "✓" : ""}
                </span>
                <strong className="text-red-800">RED *</strong>
                <span className="text-red-950">
                  {" "}
                  – SUPPORT REVIEW GIVES SIGNIFICANT CAUSE FOR CONCERN DUE TO RISK ITEMS AND/OR
                  ONGOING CONCERNS.
                </span>
                <div className="mt-1 text-xs font-normal text-red-900">
                  ACTION: Action plan produced after local review at site within 3 working days
                  (LEAD Project Manager, signed off by Installation Director)
                </div>
                <div className="mt-1 text-xs font-normal italic text-red-800">
                  * NB: CATEGORY TO BE APPLIED ONLY AFTER REVIEW WITH H&amp;S ADVISOR &amp; PRINCIPAL
                  CONTRACTOR
                </div>
              </button>
            </td>
            <td
              className={cn(
                "border border-black px-2 py-2 text-center align-middle",
                hsStatus === "RED" ? "bg-red-200" : "bg-red-50",
              )}
            >
              <StatusTick fieldKey="hsStatusRedTick" {...bind} />
            </td>
            <td
              colSpan={2}
              className="border border-black bg-slate-50 px-2 py-2 text-xs text-neutral-700"
            >
              See items above and picture section
            </td>
          </tr>
        </tbody>
      </table>

      <SectionTitle>Site Health and Safety Performance Measures: Scoring</SectionTitle>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black bg-green-50 px-2 py-2">
              <strong className="text-green-800">A – GOOD STANDARD</strong>
              <span className="text-green-950">
                {" "}
                – Correct standard and/or approach in place
              </span>
            </td>
          </tr>
          <tr>
            <td className="border border-black bg-yellow-50 px-2 py-2">
              <strong className="text-yellow-900">B – BASIC-STANDARD</strong>
              <span className="text-yellow-950">
                {" "}
                – moderate improvement sought (NB. issue WITHOUT high potential for injury) or an
                improvement on site action required
              </span>
            </td>
          </tr>
          <tr>
            <td className="border border-black bg-red-50 px-2 py-2">
              <strong className="text-red-800">C – SUBSTANDARD</strong>
              <span className="text-red-950">
                {" "}
                – site condition WITH high potential for injury, or inappropriate site action or
                non-action, and so below requirements
              </span>
            </td>
          </tr>
        </tbody>
      </table>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "46%" }} />
            <col style={{ width: "14%" }} />
            <col style={{ width: "40%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-black bg-sky-700 px-2 py-2 text-left font-semibold text-white">
                STANDARD
              </th>
              <th className="border border-black bg-sky-700 px-2 py-2 text-center font-semibold text-white">
                SCORE
                <div className="text-[10px] font-medium text-sky-100">A / B / C</div>
              </th>
              <th className="border border-black bg-sky-700 px-2 py-2 text-left font-semibold text-white">
                Comments / Correction Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {SHEQ_STANDARDS.map((standard, i) => {
              const fieldKey = `st_${i + 1}`;
              return (
                <tr
                  key={fieldKey}
                  className={cn("align-top", i % 2 === 0 ? "bg-white" : "bg-sky-50/60")}
                >
                  <td className="border border-black px-2 py-2">
                    <div className="font-medium">{standard.title}</div>
                    <div className="mt-0.5 text-xs text-neutral-600">{standard.detail}</div>
                  </td>
                  <td className="border border-black p-0 align-middle">
                    <CompliantScoreSelect fieldKey={`${fieldKey}_compliant`} {...bind} />
                  </td>
                  <td className="border border-black p-0">
                    <EditableValue
                      fieldKey={`${fieldKey}_comments`}
                      {...bind}
                      className="min-h-12"
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <SectionTitle>
        Comments/Actions (Please state any comments or correctives actions required in this box)
      </SectionTitle>
      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black p-0">
              <EditableValue
                fieldKey="commentsActions"
                {...bind}
                multiline
                className="min-h-20"
                placeholder="Comments / corrective actions"
              />
            </td>
          </tr>
        </tbody>
      </table>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            <col style={{ width: "40%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
            <col style={{ width: "20%" }} />
          </colgroup>
          <thead>
            <tr>
              <th className="border border-black bg-slate-800 px-2 py-2 text-left font-semibold text-white">
                Actions Required
              </th>
              <th className="border border-black bg-slate-800 px-2 py-2 text-left font-semibold text-white">
                By Who
              </th>
              <th className="border border-black bg-slate-800 px-2 py-2 text-left font-semibold text-white">
                By When
              </th>
              <th className="border border-black bg-slate-800 px-2 py-2 text-left font-semibold text-white">
                Date Closed
              </th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 7 }, (_, i) => (
              <tr key={i}>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`site_sheq_action_${i}_actions_required`}
                    {...bind}
                    className="min-h-10"
                  />
                </td>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`site_sheq_action_${i}_by_who`}
                    {...bind}
                    className="min-h-10"
                  />
                </td>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`site_sheq_action_${i}_by_when`}
                    {...bind}
                    className="min-h-10"
                  />
                </td>
                <td className="border border-black p-0">
                  <EditableValue
                    fieldKey={`site_sheq_action_${i}_date_closed`}
                    {...bind}
                    className="min-h-10"
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DocumentChrome>
  );
}

export function SiteInductionDocument({ template, values, onChange, editable }: DocProps) {
  const bind = { values, onChange, editable };
  const inductionCols = [
    { key: "date", label: "Date", width: "8%" },
    { key: "name", label: "Name (capitals)", width: "14%" },
    { key: "signature", label: "Signature", width: "12%", signature: true },
    { key: "employed_by", label: "Employed by", width: "12%" },
    { key: "occupation", label: "Occupation", width: "11%" },
    { key: "competency", label: "Competency card", width: "11%" },
    { key: "card_details", label: "Card type / No. / Expiry", width: "18%" },
    { key: "inductor", label: "Person giving induction", width: "14%" },
  ] as const;

  return (
    <DocumentChrome
      className="site-induction-doc"
      meta={{
        title: "Site Induction Register",
        documentNo: template.documentNo || template.code || "",
        approvedBy: template.approvedBy || "",
        dateLabel: "",
        logoLeft: template.logoLeft,
        logoRight: template.logoRight,
      }}
      {...bind}
    >
      <table className="w-full table-fixed border-collapse text-sm">
        <colgroup>
          <col className="w-[120px]" />
          <col />
          <col className="w-[120px]" />
          <col />
        </colgroup>
        <tbody>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Project title
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="projectName" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Scope of Work
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="scopeOfWork" {...bind} />
            </td>
          </tr>
          <tr>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Location
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="location" {...bind} />
            </td>
            <th className="border border-black bg-neutral-50 px-2 py-2 text-left font-medium">
              Contract no.
            </th>
            <td className="border border-black p-0">
              <EditableValue fieldKey="contractNo" {...bind} />
            </td>
          </tr>
        </tbody>
      </table>

      <table className="w-full border-collapse text-sm">
        <tbody>
          <tr>
            <td className="border border-black px-3 py-3 leading-relaxed text-neutral-800">
              I confirm that I have attended the site induction, understand the site rules and that
              I am not taking medication or drugs that could affect my concentration or safety on
              site.
            </td>
          </tr>
        </tbody>
      </table>

      <div className="overflow-x-auto">
        <table className="w-full table-fixed border-collapse text-sm">
          <colgroup>
            {inductionCols.map((col) => (
              <col key={col.key} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr className="bg-neutral-200 text-left text-[11px] font-semibold leading-snug">
              {inductionCols.map((col) => (
                <th
                  key={col.key}
                  className="border border-black px-1.5 py-2 align-middle"
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 12 }, (_, i) => (
              <tr key={i} className="align-middle">
                {inductionCols.map((col) => (
                  <td key={col.key} className="border border-black p-0">
                    {"signature" in col && col.signature ? (
                      <DrawSignatureCell
                        fieldKey={`induction_row_${i}_${col.key}`}
                        label={`Inductee signature ${i + 1}`}
                        height={44}
                        {...bind}
                      />
                    ) : (
                      <EditableValue
                        fieldKey={`induction_row_${i}_${col.key}`}
                        {...bind}
                        className="min-h-11 px-1.5 text-xs"
                      />
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DocumentChrome>
  );
}

export function renderDocumentTemplate(
  template: Template,
  bindings: DocumentFormBindings = {},
) {
  const props = { template, ...bindings };
  switch (template.kind) {
    case "rams-briefing":
      return <RamsBriefingDocument {...props} />;
    case "safe-start":
      return <SafeStartDocument {...props} />;
    case "audit-action":
      return <AuditActionDocument {...props} />;
    case "puwer":
      return <PuwerDocument {...props} />;
    case "loler":
      return <LolerDocument {...props} />;
    case "site-sheq":
      return <SiteSheqDocument {...props} />;
    case "site-induction":
      return <SiteInductionDocument {...props} />;
    case "ohs-concern":
      return <OhsConcernDocument {...props} />;
    case "quality-concern":
      return <QualityConcernDocument {...props} />;
    case "good-practice":
      return <GoodPracticeDocument {...props} />;
    case "sustainability-concern":
      return <SustainabilityConcernDocument {...props} />;
    case "sheq-service-report":
      return <SheqServiceReportDocument {...props} />;
    case "sheq-installation-report":
      return <SheqInstallationReportDocument {...props} />;
    case "alimak-weekly-check":
      return <AlimakWeeklyCheckDocument {...props} />;
    default:
      return null;
  }
}
