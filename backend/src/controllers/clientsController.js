// src/controllers/clientsController.js
const asyncHandler = require("express-async-handler");
const prisma = require("../prismaClient");
const { validatePlainCompanyName } = require("../utils/plainTextCompany");
const {
  buildClientListWhere,
  canAccessClientById,
  canManageAllClients,
} = require("../utils/clientAccess");
const { resolveTokenRole } = require("../utils/userAuthorization");
const { dedupeClientsByName, normalizeClientNameKey } = require("../utils/clientName");

exports.listClients = asyncHandler(async (req, res) => {
  const scope = buildClientListWhere(req);
  if (scope.forbidden) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  const { name } = req.query;
  const where = { ...scope.where };

  if (name) {
    where.name = { contains: name, mode: "insensitive" };
  }

  const clients = await prisma.client.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });

  const normalized = clients.map((c) => ({
    id: c.id,
    name: c.name,
    logo: c.logo || null,
    createdAt: c.createdAt,
  }));
  res.json({ success: true, clients: dedupeClientsByName(normalized) });
});

exports.createClient = asyncHandler(async (req, res) => {
  try {
    if (!canManageAllClients(resolveTokenRole(req.user))) {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }

    const { name } = req.body;
    const nameCheck = validatePlainCompanyName(name || "", "Client name");
    if (!nameCheck.ok) {
      return res.status(400).json({
        success: false,
        message: nameCheck.message,
        errors: { name: nameCheck.message },
      });
    }

    const logoUrl = req.file ? req.file.path : (req.body.logo || null);

    const existing = await prisma.client.findFirst({
      where: { name: { equals: nameCheck.value, mode: "insensitive" } },
    });
    if (existing) {
      return res.status(409).json({
        success: false,
        message: "A client with this name already exists",
        errors: { name: "A client with this name already exists" },
      });
    }

    const client = await prisma.client.create({
      data: {
        name: nameCheck.value,
        logo: logoUrl || null
      }
    });

    res.status(201).json({
      success: true,
      message: 'Client created',
      client: { id: client.id, name: client.name, logo: client.logo || null },
    });
  } catch (err) {
    console.error('CREATE CLIENT ERROR:', err);
    res.status(500).json({
      success: false,
      message: err.message || 'Server error',
      stack: err.stack ? err.stack.split('\n').slice(0, 5) : undefined,
    });
  }
});

exports.deleteClient = asyncHandler(async (req, res) => {
  try {
    if (!canManageAllClients(resolveTokenRole(req.user))) {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }

    const { id } = req.params;
    console.log(`🗑️ DELETE REQUEST RECEIVED for ID: ${id}`);
    console.log(`User requesting delete:`, req.user);

    // Check if client exists first
    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      console.log("❌ Client not found in DB");
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    await prisma.client.delete({ where: { id } });
    console.log(`✅ Client deleted successfully: ${id}`);

    return res.json({ success: true, message: "Client deleted successfully", id });
  } catch (err) {
    console.error("🔥 DELETE CLIENT ERROR:", err);
    return res.status(500).json({ success: false, message: err.message || "Server error" });
  }
});

exports.updateClient = asyncHandler(async (req, res) => {
  try {
    const { id } = req.params;
    const { name } = req.body;

    if (!canAccessClientById(req, id)) {
      return res.status(403).json({ success: false, message: "Insufficient permissions" });
    }

    console.log(`UPDATE CLIENT - id: ${id}, body:`, req.body);
    if (req.file) console.log(`UPDATE CLIENT - file received:`, req.file.path);

    const client = await prisma.client.findUnique({ where: { id } });
    if (!client) {
      return res.status(404).json({ success: false, message: "Client not found" });
    }

    const role = resolveTokenRole(req.user);
    if (!canManageAllClients(role) && role === "company_admin") {
      // company_admin may update own org branding only (not rename to another org)
      if (typeof name === "string" && name.trim() && name.trim() !== client.name) {
        return res.status(403).json({
          success: false,
          message: "Company admins cannot rename the organisation",
        });
      }
    }

    const data = {};

    if (typeof name === "string" && name.trim().length) {
      const nameCheck = validatePlainCompanyName(name, "Client name");
      if (!nameCheck.ok) {
        return res.status(400).json({ success: false, message: nameCheck.message });
      }
      const duplicate = await prisma.client.findFirst({
        where: {
          name: { equals: nameCheck.value, mode: "insensitive" },
          NOT: { id },
        },
      });
      if (duplicate) {
        return res.status(409).json({
          success: false,
          message: "A client with this name already exists",
        });
      }
      data.name = nameCheck.value;
    }

    // if a new file uploaded, use the Cloudinary URL
    if (req.file) {
      const newLogo = req.file.path;
      // OPTIONAL: Delete old image from Cloudinary if needed.
      data.logo = newLogo;
    }

    const updatedClient = await prisma.client.update({
      where: { id },
      data
    });

    res.json({
      success: true,
      message: 'Client updated',
      client: { id: updatedClient.id, name: updatedClient.name, logo: updatedClient.logo || null },
    });
  } catch (err) {
    console.error('UPDATE CLIENT ERROR:', err);
    res.status(500).json({ success: false, message: err.message || 'Server error' });
  }
});

exports.getClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (!canAccessClientById(req, id)) {
    return res.status(403).json({ success: false, message: "Insufficient permissions" });
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return res.status(404).json({ success: false, message: "Client not found" });
  }
  res.json({ success: true, client });
});


exports.getUsersByClient = asyncHandler(async (req, res) => {
  const { id } = req.params;
  console.log("GET /clients/:id/users -> id:", id);

  // Prisma doesn't strictly need validation, checking existence is enough
  if (!id) {
    console.warn("Invalid client id:", id);
    return res.status(400).json({ success: false, message: "Invalid client id" });
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    console.warn("Client not found for id:", id);
    return res.status(404).json({ success: false, message: "Client not found" });
  }

  // if client name is 'safetynett' (case-insensitive) return all users
  if (normalizeClientNameKey(client.name) === "safetynett") {
    console.log("Client is safetynett — returning all users");
    const users = await prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      select: {
        id: true, username: true, firstName: true, lastName: true, email: true,
        jobTitle: true, companyname: true, mobile: true, role: true, active: true,
        clientId: true, createdAt: true, updatedAt: true,
        lastLoginAt: true, lastSeenAt: true,
        // Exclude password
      }
    });
    return res.json({ success: true, users, allUsers: true });
  }

  // otherwise return only users with this clientId
  const users = await prisma.user.findMany({
    where: { clientId: id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true, username: true, firstName: true, lastName: true, email: true,
      jobTitle: true, companyname: true, mobile: true, role: true, active: true,
      clientId: true, createdAt: true, updatedAt: true,
      lastLoginAt: true, lastSeenAt: true,
      // Exclude password
    }
  });
  return res.json({ success: true, users, allUsers: false });
});
