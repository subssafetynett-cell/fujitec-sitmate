const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fields = [
    // Top Logo
    { id: "form_logo", type: "logo", alignment: "center" },
    
    // 1. PROJECT & ADMINISTRATIVE
    { id: "admin_header", type: "section_header", subheading: "ADMINISTRATIVE & PROJECT DETAILS", color: "#003049", alignment: "left" },
    {
      id: "admin_grid",
      type: "grid",
      rows: 2,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { 
        "0_0": "Project Name", "0_1": "Customer Name",
        "1_0": "Date of Observation", "1_1": "Auditor / Inspector" 
      },
      cellFields: {
        "0_0": [{ id: "project", type: "text", required: true }],
        "0_1": [{ id: "customer_name", type: "text", required: true }],
        "1_0": [{ id: "obs_date", type: "date", required: true }],
        "1_1": [{ id: "auditor", type: "text" }]
      }
    },

    // 2. INCIDENT CLASSIFICATION
    { id: "incident_header", type: "section_header", subheading: "INCIDENT CLASSIFICATION", color: "#003049", alignment: "left" },
    { 
      id: "incident_types", 
      label: "Nature of Health & Safety Concern:", 
      type: "checkbox", 
      bordered: true,
      columns: 3,
      options: [
        { id: "opt1", label: "Slip, trip, or fall.", value: "Slip, trip, or fall." },
        { id: "opt2", label: "Unsafe working at height.", value: "Unsafe working at height." },
        { id: "opt3", label: "Failure, misuse, unsafe equipment.", value: "Failure, misuse, unsafe equipment." },
        { id: "opt4", label: "Electrical hazard.", value: "Electrical hazard." },
        { id: "opt5", label: "Traffic movement.", value: "Traffic movement." },
        { id: "opt6", label: "Contact with machinery.", value: "Contact with machinery." },
        { id: "opt7", label: "Welfare Issue.", value: "Welfare Issue." },
        { id: "opt8", label: "Threatening behaviour.", value: "Threatening behaviour." },
        { id: "opt9", label: "Poor access/egress.", value: "Poor access/egress." },
        { id: "opt10", label: "Falling objects.", value: "Falling objects." },
        { id: "opt11", label: "Mechanical hazards.", value: "Mechanical hazards." },
        { id: "opt12", label: "Harmful substances.", value: "Harmful substances." },
        { id: "opt13", label: "Fire hazard.", value: "Fire hazard." },
        { id: "opt14", label: "Noise / Vibration.", value: "Noise / Vibration." },
        { id: "opt15", label: "Mesh lift shaft.", value: "Mesh lift shaft." },
        { id: "opt16", label: "Stored energy / Hydraulic.", value: "Stored energy / Hydraulic." },
        { id: "opt17", label: "Lattice car/landing gates.", value: "Lattice car/landing gates." },
        { id: "opt18", label: "No emergency intercom.", value: "No emergency intercom." },
        { id: "opt19", label: "Unsafe wiring.", value: "Unsafe wiring." },
        { id: "opt20", label: "Unguarded machine.", value: "Unguarded machine." },
        { id: "opt21", label: "No emergency stop.", value: "No emergency stop." },
        { id: "opt22", label: "Inadequate lift partition.", value: "Inadequate lift partition." },
        { id: "opt23", label: "Inadequate lighting.", value: "Inadequate lighting." },
        { id: "opt24", label: "Unsafe machine room access.", value: "Unsafe machine room access." },
        { id: "opt25", label: "Unsafe lift pit access.", value: "Unsafe lift pit access." },
        { id: "opt26", label: "Slipping hazards.", value: "Slipping hazards." },
        { id: "opt27", label: "Entrapment risks.", value: "Entrapment risks." },
        { id: "opt28", label: "Skirting/step trapping.", value: "Skirting/step trapping." },
        { id: "opt29", label: "Sharp edges.", value: "Sharp edges." },
        { id: "opt30", label: "Unsafe scaffolding.", value: "Unsafe scaffolding." },
      ]
    },

    // 3. LOCATION & DESCRIPTION
    { id: "desc_header", type: "section_header", subheading: "LOCATION & DETAILED OBSERVATION", color: "#003049", alignment: "left" },
    {
      id: "desc_grid",
      type: "grid",
      rows: 1,
      cols: 1,
      gridTheme: "premium",
      cellLabels: { "0_0": "Exact Location of Incident / Concern" },
      cellFields: { "0_0": [{ id: "location_incident", type: "text", required: true }] }
    },
    {
      id: "observation_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { "0_0": "OBSERVATION (WHAT YOU SEE)", "0_1": "SUGGESTION (WHAT YOU SAY)" },
      cellFields: {
        "0_0": [
            { id: "description", type: "textarea", required: true },
            { id: "attachment", label: "Upload Photo", type: "image_upload" }
        ],
        "0_1": [
            { id: "suggestion", type: "textarea", required: true },
            { id: "suggestion_attachment", label: "Upload Photo", type: "image_upload" }
        ]
      }
    },

    // 4. RESPONSIBLE PERSONS
    { id: "resp_header", type: "section_header", subheading: "RESPONSIBILITY & SIGN-OFF", color: "#003049", alignment: "left" },
    {
      id: "resp_grid",
      type: "grid",
      rows: 2,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { 
          "0_0": "Fujitec Manager", "0_1": "Fujitec Supervisor",
          "1_0": "Engineers / Responsible Person", "1_1": "Site Contact" 
      },
      cellFields: {
        "0_0": [{ id: "manager_name", type: "text" }],
        "0_1": [{ id: "supervisor_name", type: "text" }],
        "1_0": [{ id: "engineers", type: "text" }],
        "1_1": [{ id: "site_contact_name", type: "text" }]
      }
    },

    // 5. URGENCY & ALERTS
    { id: "final_grid", type: "grid", rows: 1, cols: 2, gridTheme: "premium",
      cellLabels: { "0_0": "Priority Status", "0_1": "Distribution" },
      cellFields: {
        "0_0": [{ id: "urgent", label: "Mark as Urgent?", type: "checkbox", options: [{ id: "u1", label: "Urgent Attention Required", value: "Yes" }] }],
        "0_1": [{ id: "announcement", label: "Notify All Users?", type: "checkbox", options: [{ id: "a1", label: "Send as Announcement", value: "Yes" }] }]
      }
    }
  ];

  await prisma.form.update({
    where: { id: 'health-safety-concern-static-id' },
    data: {
      fields: fields,
      title: "Health & Safety Concern Form",
      titleColor: "#003049",
      titleAlignment: "center"
    }
  });

  console.log("Form updated with refined premium table layout.");
}

main().catch(e => console.error(e)).finally(() => prisma.$disconnect());
