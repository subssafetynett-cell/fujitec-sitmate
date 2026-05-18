require("./loadEnv");
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");

const prisma = require("./src/prismaClient");
const authRoutes = require("./src/routes/auth");
const clientsRoutes = require("./src/routes/clients");
const usersRoutes = require("./src/routes/users");
const formsRoutes = require("./src/routes/forms");
const siteRoutes = require("./src/routes/sites");
const documentRoutes = require("./src/routes/documentRoutes");
const {
  startExpiredDocumentCleanupScheduler,
} = require("./src/jobs/expiredDocumentCleanup");
const { validateAppBaseUrlAtStartup } = require("./src/utils/appBaseUrl");
const { getUploadsDir } = require("./src/utils/documentStorage");

const responseRoutes = require("./src/routes/responseRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");

const path = require("path");
const fs = require("fs");

const app = express();

// Behind TLS-terminating proxy (nginx, ALB, Cloudflare): trust X-Forwarded-* headers.
// TRUST_PROXY: "0"|"false" = off; "1"|"true" or a number = hop count; unset = 1 in production, 0 otherwise.
function resolveTrustProxy() {
  if (process.env.TRUST_PROXY === "0" || process.env.TRUST_PROXY === "false") return 0;
  const v = process.env.TRUST_PROXY;
  if (v === "1" || v === "true") return 1;
  if (v && /^\d+$/.test(v)) return parseInt(v, 10);
  if (process.env.NODE_ENV === "production") return 1;
  return 0;
}
const trustProxyHops = resolveTrustProxy();
if (trustProxyHops > 0) {
  app.set("trust proxy", trustProxyHops);
}

const defaultAllowedOrigins = [
  "https://site-mateai.co.uk",
  "http://site-mateai.co.uk",
  "https://www.site-mateai.co.uk",
  "http://www.site-mateai.co.uk",
  "https://api.site-mateai.co.uk",
  "http://api.site-mateai.co.uk",
  "http://localhost:5173",
  "http://localhost:3000",
  "https://localhost:5173",
  "https://localhost:3000",
];

const extraAllowedOrigins = (process.env.ALLOWED_ORIGINS || "")
  .split(",")
  .map((s) => s.trim().replace(/\/$/, ""))
  .filter(Boolean);

const allowedOrigins = [...new Set([...defaultAllowedOrigins, ...extraAllowedOrigins])];

/** Static allowlist (known domains, previews, local dev). */
const isOriginInStaticList = (origin = "") => {
  const cleanOrigin = origin.replace(/\/$/, "");
  return (
    allowedOrigins.includes(cleanOrigin) ||
    cleanOrigin.endsWith(".vercel.app") ||
    cleanOrigin.endsWith(".sslip.io") ||
    cleanOrigin.endsWith(".nip.io") ||
    cleanOrigin.startsWith("http://localhost:") ||
    cleanOrigin.startsWith("https://localhost:") ||
    cleanOrigin.startsWith("http://127.0.0.1:") ||
    cleanOrigin.startsWith("https://127.0.0.1:")
  );
};

/**
 * SPA and API share one public hostname (e.g. Coolify + nginx). Browsers still send Origin;
 * it must be allowed even if it is not in the static list (preview URLs, sslip.io, custom domains).
 */
function isSamePublicHostOrigin(origin, req) {
  if (!origin || !req) return false;
  let publicHost = (req.headers["x-forwarded-host"] || "")
    .split(",")[0]
    .trim();
  if (!publicHost) publicHost = (req.headers.host || "").trim();
  if (!publicHost) return false;
  try {
    const o = new URL(origin);
    return o.host === publicHost;
  } catch {
    return false;
  }
}

function isOriginAllowedForRequest(origin, req) {
  if (!origin) return true;
  return isOriginInStaticList(origin) || isSamePublicHostOrigin(origin, req);
}

// Manual CORS fallback so preflight never gets dropped by later middleware/proxy layers.
app.use((req, res, next) => {
  const origin = req.headers.origin;

  if (origin && isOriginAllowedForRequest(origin, req)) {
    res.header("Access-Control-Allow-Origin", origin);
    res.header("Vary", "Origin");
    res.header("Access-Control-Allow-Credentials", "true");
    res.header("Access-Control-Allow-Methods", "GET,POST,PUT,DELETE,OPTIONS,PATCH");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With, Accept");
  }

  if (req.method === "OPTIONS") {
    return res.sendStatus(204);
  }

  next();
});

const corsMethods = ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"];
const corsAllowedHeaders = ["Content-Type", "Authorization", "X-Requested-With", "Accept"];

/** Per-request delegate so Origin can be matched against Host / X-Forwarded-Host (Coolify, etc.). */
const corsDelegate = (req, callback) => {
  callback(null, {
    origin(origin, cb) {
      if (!origin) return cb(null, true);
      if (isOriginAllowedForRequest(origin, req)) return cb(null, true);
      console.log("Blocked by CORS:", origin);
      cb(new Error("Not allowed by CORS"));
    },
    methods: corsMethods,
    credentials: true,
    allowedHeaders: corsAllowedHeaders,
  });
};

app.use(cors(corsDelegate));
app.options(/.*/, cors(corsDelegate)); // Enable pre-flight for all routes using same options

// CORS Debugging Middleware
app.use((req, res, next) => {
  if (req.headers.origin) {
    console.log(`[CORS DEBUG] Request from: ${req.headers.origin} | Method: ${req.method} | URL: ${req.url}`);
  }
  next();
});

const uploadsDir = getUploadsDir();

// Serve uploads before helmet so PDF/image previews are not blocked by CSP (object-src 'none').
app.use(
  "/uploads",
  (req, res, next) => {
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    next();
  },
  express.static(uploadsDir)
);

app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

app.use(express.json({ limit: "50mb" }));

app.use("/api/auth", authRoutes);
app.use("/api/clients", clientsRoutes);
app.use("/api/forms", formsRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/sites", siteRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/responses", responseRoutes);
app.use("/api/dashboard", dashboardRoutes);

app.use((err, req, res, next) => { 
  console.error("Error Handler:", err);

  if (err.message === "Not allowed by CORS") {
    return res.status(403).json({
      success: false,
      message: "Origin not allowed. Set ALLOWED_ORIGINS to your app URL (comma-separated) or use the same hostname for the SPA and API.",
    });
  }

  // Prisma specific error handling could go here
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: `Unique constraint failed on the fields: ${err.meta.target}`
    });
  }

  if (err.code === 'P2021') {
    return res.status(500).json({
      success: false,
      message: "Database schema is missing required tables. Run Prisma schema deployment on the server."
    });
  }

  res
    .status(err.status || 500)
    .json({
      success: false,
      message: err.message || "Server error",
      debug_stack: process.env.NODE_ENV === 'production' ? undefined : err.stack // Expose stack for debug
    });
});

app.get("/", (req, res) => {
  res.send("Server is running");
});

app.get("/api/health", (req, res) => {
  res.json({
    success: true,
    message: "Health check",
    serverTime: new Date().toISOString(),
    dbStatus: "Connected (Prisma)", // Prisma lazy connects
    env: {
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      hasAppUrl: !!(process.env.APP_URL || process.env.BASE_URL || process.env.FRONTEND_URL),
      nodeEnv: process.env.NODE_ENV
    }
  });
});

const start = async () => {
  validateAppBaseUrlAtStartup();

  const uploadsDir = getUploadsDir();

  if (!fs.existsSync(uploadsDir)) {
    try {
      fs.mkdirSync(uploadsDir, { recursive: true });
      console.log(`Created uploads dir: ${uploadsDir}`);
    } catch (err) {
      console.warn(`Failed to create uploads dir at startup: ${uploadsDir}. Will attempt lazy creation on upload.`, err);
    }
  }

  try {
    // await connectDB(); // Prisma auto-connects

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      startExpiredDocumentCleanupScheduler();
    });

    // Run seeding in the background so it doesn't block server startup
    (async () => {
      try {
        const clientName = "Safetynett";
        const existingClient = await prisma.client.findUnique({
          where: { name: clientName }
        });

        if (!existingClient) {
          await prisma.client.create({
            data: { name: clientName }
          });
          console.log(`Client '${clientName}' created successfully.`);
        } else {
          console.log(`Client '${clientName}' already exists.`);
        }
      } catch (err) {
        console.error("Background seeding failed (is the DB URL correct?):", err.message);
      }
    })();
  } catch (err) {
    console.error("Failed to start server/db, exiting.", err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
