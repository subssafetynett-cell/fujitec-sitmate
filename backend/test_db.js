const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const fuser = await prisma.user.findFirst({ where: { companyname: "fujitec" }, include: { client: true } });
  console.log("User fujitec:", JSON.stringify(fuser, null, 2));
  
  const allClients = await prisma.client.findMany();
  console.log("All clients:", JSON.stringify(allClients, null, 2));
}

main().catch(console.error).finally(() => prisma.$disconnect());
