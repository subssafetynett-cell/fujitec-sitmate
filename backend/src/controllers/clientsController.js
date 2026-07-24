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
const { dedupeClientsByName, normalizeClientNameKey, buildClientNameFields, isClientNameUniqueViolation, clientNameConflictBody } = require("../utils/clientName");

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
    const { name: clientName, nameKey } = buildClientNameFields(nameCheck.value);

    const client = await prisma.client.create({
      data: {
        name: clientName,
        nameKey,
        logo: logoUrl || null,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Client created',
      client: { id: client.id, name: client.name, logo: client.logo || null },
    });
  } catch (err) {
    if (isClientNameUniqueViolation(err)) {
      return res.status(409).json(clientNameConflictBody());
    }
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
      const nextName = buildClientNameFields(nameCheck.value);
      data.name = nextName.name;
      data.nameKey = nextName.nameKey;
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
    if (isClientNameUniqueViolation(err)) {
      return res.status(409).json(clientNameConflictBody(false));
    }
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

  if (!id) {
    return res.status(400).json({ success: false, message: "Invalid client id" });
  }

  const client = await prisma.client.findUnique({ where: { id } });
  if (!client) {
    return res.status(404).json({ success: false, message: "Client not found" });
  }

  const page = Math.max(0, parseInt(req.query.page, 10) || 0);
  const limitRaw = parseInt(req.query.limit, 10);
  const limit = Math.min(100, Math.max(1, Number.isFinite(limitRaw) ? limitRaw : 10));
  const search = String(req.query.search || "").trim();
  const company = String(req.query.company || "").trim();
  const status = String(req.query.status || "all").trim().toLowerCase();
  const role = String(req.query.role || "all").trim().toLowerCase();

  const isSafetyNett = normalizeClientNameKey(client.name) === "safetynett";
  const where = {
    accessMode: { not: "view_only" },
    ...(isSafetyNett ? {} : { clientId: id }),
  };

  if (search) {
    where.OR = [
      { firstName: { contains: search, mode: "insensitive" } },
      { lastName: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
      { username: { contains: search, mode: "insensitive" } },
    ];
  }
  if (company) {
    where.companyname = { contains: company, mode: "insensitive" };
  }
  if (status === "active") where.active = true;
  if (status === "inactive") where.active = false;
  if (role && role !== "all") where.role = role;

  const select = {
    id: true,
    username: true,
    firstName: true,
    lastName: true,
    email: true,
    jobTitle: true,
    companyname: true,
    mobile: true,
    role: true,
    active: true,
    clientId: true,
    createdAt: true,
    updatedAt: true,
    lastLoginAt: true,
    lastSeenAt: true,
    accessMode: true,
    allowedPages: true,
  };

  const [total, users] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: page * limit,
      take: limit,
      select,
    }),
  ]);

  const formatted = users.map((u) => ({
    _id: u.id,
    id: u.id,
    username: u.username,
    firstName: u.firstName,
    lastName: u.lastName,
    email: u.email,
    jobTitle: u.jobTitle || "",
    companyname: u.companyname || "",
    mobile: u.mobile || "",
    clientId: u.clientId,
    role: u.role || "worker",
    accessMode: u.accessMode || "standard",
    allowedPages: Array.isArray(u.allowedPages) ? u.allowedPages : [],
    active: typeof u.active === "boolean" ? u.active : true,
    createdAt: u.createdAt,
    updatedAt: u.updatedAt,
    lastLoginAt: u.lastLoginAt,
    lastSeenAt: u.lastSeenAt,
  }));

  return res.json({
    success: true,
    users: formatted,
    total,
    page,
    limit,
    allUsers: isSafetyNett,
  });
});
