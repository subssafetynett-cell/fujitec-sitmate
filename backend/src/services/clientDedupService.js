const {
  CANONICAL_SAFETYNETT_NAME,
  isSafetynettCompanyName,
} = require("../utils/clientName");

async function mergeDuplicateSafetynettClients(prisma) {
  const clients = await prisma.client.findMany({
    orderBy: { createdAt: "asc" },
  });

  const safetynettClients = clients.filter((client) =>
    isSafetynettCompanyName(client.name)
  );

  if (safetynettClients.length === 0) return { merged: 0 };

  const canonical =
    safetynettClients.find((client) => client.name === CANONICAL_SAFETYNETT_NAME) ||
    safetynettClients[0];
  const duplicates = safetynettClients.filter((client) => client.id !== canonical.id);

  for (const duplicate of duplicates) {
    await prisma.user.updateMany({
      where: { clientId: duplicate.id },
      data: {
        clientId: canonical.id,
        companyname: CANONICAL_SAFETYNETT_NAME,
      },
    });
    await prisma.site.updateMany({
      where: { clientId: duplicate.id },
      data: { clientId: canonical.id },
    });
    await prisma.client.delete({ where: { id: duplicate.id } });
  }

  if (canonical.name !== CANONICAL_SAFETYNETT_NAME) {
    await prisma.client.update({
      where: { id: canonical.id },
      data: { name: CANONICAL_SAFETYNETT_NAME },
    });
  }

  if (duplicates.length > 0) {
    console.log(
      `Merged ${duplicates.length} duplicate Safetynett client record(s) into '${CANONICAL_SAFETYNETT_NAME}'.`
    );
  }

  return { merged: duplicates.length, canonicalId: canonical.id };
}

module.exports = { mergeDuplicateSafetynettClients };
