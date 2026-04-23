const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const title = "SHEQ Installation Service Report";
    const existing = await prisma.form.findFirst({
        where: { title }
    });

    if (existing) {
        console.log("Form already exists:", existing.id);
    } else {
        const newForm = await prisma.form.create({
            data: {
                title,
                fields: [
                    {
                        id: "custom_hardcoded_form_data",
                        type: "text",
                        label: "Form Data Indicator",
                        required: false
                    }
                ],
                titleColor: "#000000",
                titleAlignment: "left"
            }
        });
        console.log("Created form:", newForm.id);
    }
}

main()
    .catch(e => console.error(e))
    .finally(() => prisma.$disconnect());
