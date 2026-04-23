const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const formTitle = "Health & Safety Concern Form";
  const fields = [
    { id: "project_details_header", type: "section_header", subheading: "PROJECT DETAILS", color: "#003049", alignment: "center" },
    {
      id: "project_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { "0_0": "Project Name", "0_1": "Customer Name" },
      cellFields: {
        "0_0": [{ id: "project", type: "text", required: true }],
        "0_1": [{ id: "customer_name", type: "text", required: true }]
      }
    },

    { id: "location_header", type: "section_header", subheading: "LOCATION DETAILS", color: "#003049", alignment: "center" },
    {
      id: "location_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { "0_0": "Full Address", "0_1": "Exact Location of Incident" },
      cellFields: {
        "0_0": [{ id: "address", type: "text" }],
        "0_1": [{ id: "location_incident", type: "text" }]
      }
    },

    { id: "incident_header", type: "section_header", subheading: "INCIDENT CLASSIFICATION", color: "#003049", alignment: "center" },
    { 
      id: "incident_types", 
      label: "Select all applicable health and safety incidents:", 
      type: "checkbox", 
      bordered: true,
      columns: 3, // 3 columns for minimal look
      options: [
        { id: "opt1", label: "Slip, trip, or fall.", value: "Slip, trip, or fall." },
        { id: "opt2", label: "Unsafe working at height.", value: "Unsafe working at height." },
        { id: "opt3", label: "Failure, misuse, unsafe equipment.", value: "Failure, misuse, unsafe equipment." },
        { id: "opt4", label: "Electrical hazard.", value: "Electrical hazard." },
        { id: "opt5", label: "Traffic movement.", value: "Traffic movement." },
        { id: "opt6", label: "Contact, exposure to equipment or machinery.", value: "Contact, exposure to equipment or machinery." },
        { id: "opt7", label: "Welfare Issue.", value: "Welfare Issue." },
        { id: "opt8", label: "Threatening behaviour.", value: "Threatening behaviour." },
        { id: "opt9", label: "Poor site access, egress.", value: "Poor site access, egress." },
        { id: "opt10", label: "Failing objects, equipment.", value: "Failing objects, equipment." },
        { id: "opt11", label: "Mechanical hazards.", value: "Mechanical hazards." },
        { id: "opt12", label: "Contact, exposure to harmful substances.", value: "Contact, exposure to harmful substances." },
        { id: "opt13", label: "Fire hazard.", value: "Fire hazard." },
        { id: "opt14", label: "Noise, vibration.", value: "Noise, vibration." },
        { id: "opt15", label: "Mesh lift shaft.", value: "Mesh lift shaft." },
        { id: "opt16", label: "Stored energy hydraulic.", value: "Stored energy hydraulic." },
        { id: "opt17", label: "Open lattice car and landing gates.", value: "Open lattice car and landing gates." },
        { id: "opt18", label: "No emergency intercom for trapped passengers.", value: "No emergency intercom for trapped passengers." },
        { id: "opt19", label: "Unsafe wiring.", value: "Unsafe wiring." },
        { id: "opt20", label: "Unguarded machine.", value: "Unguarded machine." },
        { id: "opt21", label: "No emergency stop.", value: "No emergency stop." },
        { id: "opt22", label: "No inadequate partition for lifts.", value: "No inadequate partition for lifts." },
        { id: "opt23", label: "No inadequate lighting.", value: "No inadequate lighting." },
        { id: "opt24", label: "No unsafe access to machine room.", value: "No unsafe access to machine room." },
        { id: "opt25", label: "No unsafe access to lift pit.", value: "No unsafe access to lift pit." },
        { id: "opt26", label: "Slipping on steps / landing.", value: "Slipping on steps / landing." },
        { id: "opt27", label: "Entrapment risks.", value: "Entrapment risks." },
        { id: "opt28", label: "Trapping between skirting/step.", value: "Trapping between skirting/step." },
        { id: "opt29", label: "Sharp edges.", value: "Sharp edges." },
        { id: "opt30", label: "Unsafe scaffolding/platforms.", value: "Unsafe scaffolding/platforms." },
      ]
    },
    { id: "other_incident", label: "Other Incident Details:", type: "text", layout: "horizontal" },

    { id: "obs_header", type: "section_header", subheading: "OBSERVATIONS & SUGGESTIONS", color: "#003049", alignment: "center" },
    {
      id: "observation_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { "0_0": "YOU SEE (OBSERVATION)", "0_1": "YOU SAY (SUGGESTION)" },
      cellFields: {
        "0_0": [
            { id: "description", label: "Observation Details", type: "textarea", required: true },
            { id: "attachment", label: "Upload Photo", type: "image_upload" }
        ],
        "0_1": [
            { id: "suggestion", label: "Corrective Action Proposed", type: "textarea", required: true },
            { id: "suggestion_attachment", label: "Upload Photo", type: "image_upload" }
        ]
      }
    },

    { id: "management_header", type: "section_header", subheading: "MANAGEMENT & CONTACTS", color: "#003049", alignment: "center" },
    {
      id: "management_grid",
      type: "grid",
      rows: 2,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { 
          "0_0": "Fujitec Manager", "0_1": "Fujitec Supervisor",
          "1_0": "Responsible Person (Engineers)", "1_1": "Site Contact" 
      },
      cellFields: {
        "0_0": [{ id: "manager_name", type: "text" }],
        "0_1": [{ id: "supervisor_name", type: "text" }],
        "1_0": [{ id: "engineers", type: "text" }],
        "1_1": [{ id: "site_contact_name", type: "text" }]
      }
    },

    { id: "flags_header", type: "section_header", subheading: "FINAL STEPS", color: "#003049", alignment: "center" },
    {
      id: "flags_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      gridTheme: "premium",
      cellLabels: { "0_0": "Urgent Alert", "0_1": "Announcement" },
      cellFields: {
        "0_0": [{ id: "urgent", label: "Mark as Urgent?", type: "checkbox", options: [{ id: "u1", label: "High Priority", value: "Yes" }] }],
        "0_1": [{ id: "announcement", label: "Mark as Announcement?", type: "checkbox", options: [{ id: "a1", label: "Email All Users", value: "Yes" }] }]
      }
    }
  ];

  const form = await prisma.form.update({
    where: { id: 'health-safety-concern-static-id' },
    data: {
      fields: fields,
      titleColor: "#003049",
      titleAlignment: "center"
    }
  });

  console.log("Form updated with absolute final premium layout:", form.id);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
