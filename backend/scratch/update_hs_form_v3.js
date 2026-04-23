const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const user = await prisma.user.findFirst({
    where: { role: 'superadmin' }
  }) || await prisma.user.findFirst();

  if (!user) {
    console.error("No user found to associate with the form");
    return;
  }

  const formTitle = "Health & Safety Concern Form";
  const fields = [
    { id: "site_building", label: "Site/ Building", type: "text", required: true, layout: "horizontal" },
    { id: "customer_name", label: "Customer Name", type: "text", required: true, layout: "horizontal" },
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
      ]
    },
    { id: "description_header", type: "section_header", subheading: "Describe the health and safety concern [unsafe act / unsafe condition]", alignment: "center" },
    { id: "description", label: "Describe what you see", type: "textarea", required: true },
    { id: "attachment", label: "Upload file:", type: "image_upload" }
  ];

  const form = await prisma.form.update({
    where: { id: 'health-safety-concern-static-id' },
    data: {
      title: formTitle,
      fields: fields,
    }
  });

  console.log("Form updated with horizontal layout:", form.id);
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
