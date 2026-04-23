const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const forms = await prisma.form.findMany({
    select: { id: true, title: true }
  });
  console.log(JSON.stringify(forms, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
