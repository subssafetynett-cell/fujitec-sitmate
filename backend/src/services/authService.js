const prisma = require("../prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

exports.signup = async (payload) => {
  const {
    username,
    firstName,
    lastName,
    email,
    jobTitle,
    employer, // company name from frontend
    mobile,
    password,
  } = payload;

  console.log("Signup Step 1: Checking existing user");
  // 1️⃣ Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: email, mode: 'insensitive' } },
        { username: { equals: username, mode: 'insensitive' } }
      ]
    }
  });
  if (existingUser) {
    console.log("Signup Error: User already exists");
    const err = new Error("User with this email or username already exists");
    err.status = 409;
    throw err;
  }

  console.log("Signup Step 2: Checking/Creating client");
  // 2️⃣ Check if company (client) exists — case-insensitive
  const companyName = employer?.trim();
  if (!companyName) {
    const err = new Error("Company name is required");
    err.status = 400;
    throw err;
  }

  let client = await prisma.client.findFirst({
    where: {
      name: { equals: companyName, mode: 'insensitive' }
    }
  });

  if (!client) {
    // Auto-create company if not found
    console.log(`Company '${companyName}' not found. Creating new client.`);
    client = await prisma.client.create({
      data: { name: companyName }
    });
    console.log(`Client created: ${client.id}`);
  } else {
    console.log(`Client found: ${client.id}`);
  }

  console.log("Signup Step 3: Hashing password");
  // 3️⃣ Hash password
  const hashed = await bcrypt.hash(password, 10);

  console.log("Signup Step 4: Creating user");
  // 4️⃣ Create user linked to client
  const user = await prisma.user.create({
    data: {
      username,
      firstName,
      lastName,
      email,
      jobTitle,
      companyname: client.name, // store canonical name
      mobile,
      password: hashed,
      clientId: client.id,
    }
  });
  console.log(`User created: ${user.id}`);

  console.log("Signup Step 5: Generating token");
  // 5️⃣ Generate token
  if (!process.env.JWT_SECRET) {
    console.error("Signup Error: JWT_SECRET missing");
    throw new Error("JWT_SECRET is not defined in environment variables");
  }
  // Safetynett users are always superadmin
  const effectiveRole = (user.companyname || "").trim().toLowerCase() === "safetynett"
    ? "superadmin"
    : user.role;

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      clientId: client.id,
      companyname: user.companyname
    },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
  console.log("Signup Complete: Token generated");

  return { user: { ...user, role: effectiveRole }, token };
};



exports.login = async ({ email, password }) => {
  if (!email || !password) {
    const e = new Error('Email and password required');
    e.status = 400;
    throw e;
  }

  const lookup = String(email).trim();
  console.log('DEBUG: login attempt for ->', lookup);

  // find by email (case-insensitive) or username exact
  // find by email (case-insensitive) or username exact
  const user = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: lookup, mode: 'insensitive' } },
        { username: { equals: lookup, mode: 'insensitive' } }
      ]
    },
    include: { client: true }
  });

  if (!user) {
    console.warn('DEBUG: user not found for ->', lookup);
    const e = new Error('Invalid credentials');
    e.status = 401;
    throw e;
  }

  console.log('DEBUG: user found id=', user.id, 'email=', user.email, 'username=', user.username);

  if (!user.password) {
    console.warn('DEBUG: user has no password stored (id=', user.id, ')');
    const e = new Error('Invalid credentials');
    e.status = 401;
    throw e;
  }

  const matches = await bcrypt.compare(password, user.password);
  console.log('DEBUG: bcrypt compare result ->', matches);

  if (!matches) {
    console.warn('DEBUG: password mismatch for user id=', user.id);
    const e = new Error('Invalid credentials');
    e.status = 401;
    throw e;
  }

  if (!process.env.JWT_SECRET) {
    throw Object.assign(new Error('JWT_SECRET missing'), { status: 500 });
  }

  // Safetynett users are always superadmin
  const effectiveRole = (user.companyname || "").trim().toLowerCase() === "safetynett"
    ? "superadmin"
    : user.role;

  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: effectiveRole,
      clientId: user.clientId,
      companyname: user.companyname
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const u = { ...user, role: effectiveRole };
  delete u.password;
  return { user: u, token };
};

