const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const formTitle = "Health & Safety Concern Form";
  const fields = [
    { id: "site_building", label: "Site/ Building", type: "text", required: true, layout: "horizontal" },
    { id: "customer_name", label: "Customer Name", type: "text", required: true, layout: "horizontal" },
    
    { id: "address_header", type: "section_header", subheading: "Address", color: "#2563EB", alignment: "center" },
    { id: "address", label: "Address:", type: "text" },
    
    { id: "location_header", type: "section_header", subheading: "Location of Incident", color: "#2563EB", alignment: "center" },
    { id: "location_incident", label: "Location of incident:", type: "text" },

    { id: "incident_type_header", type: "section_header", subheading: "Incident Type", color: "#2563EB", alignment: "center" },
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
    { id: "other_incident", label: "Other:", type: "text" },

    { id: "description_header", type: "section_header", subheading: "Describe the health and safety concern [unsafe act / unsafe condition]", alignment: "center" },
    { id: "description", label: "Describe what you see", type: "textarea", required: true },
    { id: "attachment", label: "Upload file:", type: "image_upload" },

    { id: "suggestion_header", type: "section_header", subheading: "Your Suggestion / Correction proposed.", color: "#2563EB", alignment: "center" },
    { id: "suggestion", label: "What do you suggest should be done to address the concern?", type: "textarea", required: true },
    { id: "suggestion_attachment", label: "Upload file:", type: "image_upload" },

    { id: "manager_header", type: "section_header", subheading: "Fujitec Manager", color: "#2563EB", alignment: "center" },
    { id: "manager_name", label: "Manager:", type: "text" },
    
    { id: "supervisor_header", type: "section_header", subheading: "Fujitec Supervisor", color: "#2563EB", alignment: "center" },
    { id: "supervisor_name", label: "Supervisor:", type: "text" },
    
    { id: "responsible_header", type: "section_header", subheading: "Responsible Person", color: "#2563EB", alignment: "center" },
    { id: "engineers", label: "Engineers:", type: "text" },
    
    { id: "site_contact_header", type: "section_header", subheading: "Site Contact", color: "#2563EB", alignment: "center" },
    { id: "site_contact_name", label: "Site Contact:", type: "text" },

    { id: "urgent", label: "Mark as Urgent? This will let Safety Nett/ or know that this report is high priority as there is a serious immediate risk present.", type: "checkbox", options: [{ id: "u1", label: "Yes", value: "Yes" }] },
    { id: "announcement", label: "Mark as Announcement? This will let all users get an email message about the serious immediate risk present.", type: "checkbox", options: [{ id: "a1", label: "Yes", value: "Yes" }] }
  ];

  const form = await prisma.form.update({
    where: { id: 'health-safety-concern-static-id' },
    data: {
      fields: fields,
    }
  });

  console.log("Form updated with suggestions and flags:", form.id);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
