const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function main() {
  const docs = await prisma.siteDocument.findMany({
    orderBy: { createdAt: 'desc' },
    take: 5
  });
  console.log(JSON.stringify(docs, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());
