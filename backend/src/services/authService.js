const prisma = require("../prismaClient");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { validatePlainName } = require("../utils/plainTextName");
const { resolveTokenRole } = require("../utils/userAuthorization");
const { formatUserAccessFields } = require("../utils/pageAccess");

/** Generic login failure — do not reveal whether the email/username exists. */
const INVALID_CREDENTIALS_MESSAGE = "Invalid credentials.";
const INVALID_CREDENTIALS_CODE = "INVALID_CREDENTIALS";

exports.signup = async (payload) => {
  if (!process.env.JWT_SECRET) {
    const err = new Error("Server configuration error: JWT secret is missing");
    err.status = 500;
    throw err;
  }

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

  const normalizedUsername = String(username || "").trim();
  const normalizedEmail = String(email || "").trim().toLowerCase();
  const fn = validatePlainName(firstName, "First name");
  const ln = validatePlainName(lastName, "Last name");
  if (!fn.ok) {
    const err = new Error(fn.message);
    err.status = 400;
    throw err;
  }
  if (!ln.ok) {
    const err = new Error(ln.message);
    err.status = 400;
    throw err;
  }
  const normalizedFirstName = fn.value;
  const normalizedLastName = ln.value;
  const normalizedMobile = String(mobile || "").trim();
  const normalizedJobTitle = jobTitle ? String(jobTitle).trim() : null;

  console.log("Signup Step 1: Checking existing user");
  // 1️⃣ Check if user already exists
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: { equals: normalizedEmail, mode: 'insensitive' } },
        { username: { equals: normalizedUsername, mode: 'insensitive' } }
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

  const client = await prisma.client.findFirst({
    where: {
      name: { equals: companyName, mode: "insensitive" },
    },
  });

  if (!client) {
    console.log(`Signup rejected: company '${companyName}' does not match any client`);
    const err = new Error("That company does not exist. Check the name and try again.");
    err.status = 400;
    err.code = "COMPANY_NOT_FOUND";
    err.field = "employer";
    throw err;
  }

  console.log(`Client found: ${client.id}`);

  console.log("Signup Step 3: Hashing password");
  // 3️⃣ Hash password
  const hashed = await bcrypt.hash(password, 10);

  console.log("Signup Step 4: Creating user");
  // 4️⃣ Create user linked to client (emailVerified set after link click)
  const user = await prisma.user.create({
    data: {
      username: normalizedUsername,
      firstName: normalizedFirstName,
      lastName: normalizedLastName,
      email: normalizedEmail,
      jobTitle: normalizedJobTitle,
      companyname: client.name, // store canonical name
      mobile: normalizedMobile,
      password: hashed,
      clientId: client.id,
      emailVerified: false,
    }
  });
  console.log(`User created: ${user.id} (email verification required)`);

  const effectiveRole = resolveTokenRole(user);

  return {
    user: { ...user, role: effectiveRole, ...formatUserAccessFields(user) },
    clientName: client.name,
  };
};



exports.login = async ({ email, password }) => {
  if (!email || !password) {
    const e = new Error("Email and password required");
    e.status = 400;
    throw e;
  }

  const rawLogin = String(email).trim();
  const looksLikeEmail = rawLogin.includes("@");
  const emailNormalized = rawLogin.toLowerCase();

  const user = await prisma.user.findFirst({
    where: looksLikeEmail
      ? { email: { equals: emailNormalized, mode: "insensitive" } }
      : {
          OR: [
            { email: { equals: emailNormalized, mode: "insensitive" } },
            { username: { equals: rawLogin, mode: "insensitive" } },
          ],
        },
    include: { client: true },
  });

  if (!user) {
    const e = new Error(INVALID_CREDENTIALS_MESSAGE);
    e.status = 401;
    e.code = INVALID_CREDENTIALS_CODE;
    throw e;
  }

  if (!user.password) {
    const e = new Error(INVALID_CREDENTIALS_MESSAGE);
    e.status = 401;
    e.code = INVALID_CREDENTIALS_CODE;
    throw e;
  }

  const matches = await bcrypt.compare(password, user.password);
  if (!matches) {
    const e = new Error(INVALID_CREDENTIALS_MESSAGE);
    e.status = 401;
    e.code = INVALID_CREDENTIALS_CODE;
    throw e;
  }

  if (user.emailVerified === false) {
    const e = new Error(
      "Please verify your email before signing in. Check your inbox for the verification link."
    );
    e.status = 403;
    e.code = "EMAIL_NOT_VERIFIED";
    throw e;
  }

  const now = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { lastLoginAt: now, lastSeenAt: now },
  });

  const refreshed = await prisma.user.findFirst({
    where: { id: user.id },
    include: { client: true },
  });
  if (!refreshed) {
    const e = new Error("Account could not be loaded after sign-in.");
    e.status = 500;
    throw e;
  }

  if (!process.env.JWT_SECRET) {
    throw Object.assign(new Error("JWT_SECRET missing"), { status: 500 });
  }

  const effectiveRole = resolveTokenRole(refreshed);

  const token = jwt.sign(
    {
      id: refreshed.id,
      email: refreshed.email,
      role: effectiveRole,
      clientId: refreshed.clientId,
      companyname: refreshed.companyname,
    },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  const u = {
    ...refreshed,
    role: effectiveRole,
    ...formatUserAccessFields(refreshed),
  };
  delete u.password;
  delete u.twoFactorSecret;
  return { user: u, token };
};

