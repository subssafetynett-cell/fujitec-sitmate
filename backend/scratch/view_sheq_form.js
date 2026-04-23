const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const form = await prisma.form.findUnique({
    where: { id: '64e1de33-bb0a-4403-9c2c-1d5bcee84c7f' }
  });
  console.log(JSON.stringify(form, null, 2));
}

main()
  .catch(e => console.error(e))
  .finally(async () => await prisma.$disconnect());
