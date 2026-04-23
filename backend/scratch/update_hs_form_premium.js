const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const formTitle = "Health & Safety Concern Form";
  const fields = [
    { id: "header_section", type: "section_header", subheading: "Project Details", color: "#003049", alignment: "center" },
    {
      id: "project_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      colWidths: [400, 400],
      cellLabels: { "0_0": "Project", "0_1": "Customer Name" },
      cellFields: {
        "0_0": [{ id: "project", type: "text", required: true }],
        "0_1": [{ id: "customer_name", type: "text", required: true }]
      }
    },

    { id: "location_section", type: "section_header", subheading: "Location Information", color: "#003049", alignment: "center" },
    {
      id: "location_grid",
      type: "grid",
      rows: 1,
      cols: 2,
      colWidths: [400, 400],
      cellLabels: { "0_0": "Address", "0_1": "Location of Incident" },
      cellFields: {
        "0_0": [{ id: "address", type: "text" }],
        "0_1": [{ id: "location_incident", type: "text" }]
      }
    },

    { id: "incident_section", type: "section_header", subheading: "Incident Classification", color: "#003049", alignment: "center" },
    { 
      id: "incident_types", 
      label: "Select one or more health and safety incidents", 
      type: "checkbox", 
      bordered: true,
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
        { id: "opt22", label: "No or inadequate partition for several lifts in same well.", value: "No or inadequate partition for several lifts in same well." },
        { id: "opt23", label: "No or inadequate lighting of the well.", value: "No or inadequate lighting of the well." },
        { id: "opt24", label: "No or unsafe access to machine and pulley room.", value: "No or unsafe access to machine and pulley room." },
        { id: "opt25", label: "No or unsafe access to lift shaft pit.", value: "No or unsafe access to lift shaft pit." },
        { id: "opt26", label: "Slipping on steps / landing.", value: "Slipping on steps / landing." },
        { id: "opt27", label: "Entrapment between comb and step.", value: "Entrapment between comb and step." },
        { id: "opt28", label: "Trapping between skirting and step.", value: "Trapping between skirting and step." },
        { id: "opt29", label: "Sharp edges.", value: "Sharp edges." },
        { id: "opt30", label: "Unsafe scaffolding | working platforms.", value: "Unsafe scaffolding | working platforms." },
      ]
    },
    { id: "other_incident", label: "Other Incident (please specify):", type: "text" },

    { id: "observation_section", type: "section_header", subheading: "Observations & Suggestions", color: "#003049", alignment: "center" },
    {
      id: "obs_grid",
      type: "grid",
      rows: 2,
      cols: 1,
      cellLabels: { "0_0": "You See (Observation)", "1_0": "You Say (Suggestion)" },
      cellFields: {
        "0_0": [
            { id: "description", label: "Describe the health and safety concern", type: "textarea", required: true },
            { id: "attachment", label: "Upload Photo", type: "image_upload" }
        ],
        "1_0": [
            { id: "suggestion", label: "What should be done to address the concern?", type: "textarea", required: true },
            { id: "suggestion_attachment", label: "Upload Photo", type: "image_upload" }
        ]
      }
    },

    { id: "contact_section", type: "section_header", subheading: "Management & Contacts", color: "#003049", alignment: "center" },
    {
      id: "contact_grid",
      type: "grid",
      rows: 2,
      cols: 2,
      colWidths: [400, 400],
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

    { id: "final_section", type: "section_header", subheading: "Prioritization & Alerts", color: "#003049", alignment: "center" },
    { id: "urgent", label: "Mark as Urgent? (Serious immediate risk present)", type: "checkbox", options: [{ id: "u1", label: "Yes", value: "Yes" }] },
    { id: "announcement", label: "Mark as Announcement? (Notify all users via email)", type: "checkbox", options: [{ id: "a1", label: "Yes", value: "Yes" }] }
  ];

  const form = await prisma.form.update({
    where: { id: 'health-safety-concern-static-id' },
    data: {
      fields: fields,
      titleColor: "#003049",
      titleAlignment: "center"
    }
  });

  console.log("Form updated with grid layout and premium styling:", form.id);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
