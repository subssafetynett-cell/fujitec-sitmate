require("dotenv").config();
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

const responseRoutes = require("./src/routes/responseRoutes");
const dashboardRoutes = require("./src/routes/dashboardRoutes");

const path = require("path");
const fs = require("fs");

const app = express();

app.use(helmet());
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  })
);

const allowedOrigin = process.env.CLIENT_URL || "http://site-mateai.co.uk";

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (like mobile apps or curl requests)
      if (!origin) return callback(null, true);

      const allowedOrigins = [
        "http://site-mateai.co.uk",         // Main frontend (HTTP)
        "https://site-mateai.co.uk",        // Main frontend (HTTPS)
        "http://www.site-mateai.co.uk",     // Main frontend (WWW HTTP)
        "https://www.site-mateai.co.uk",    // Main frontend (WWW HTTPS)
        "http://api.site-mateai.co.uk",     // Backend itself (HTTP)
        "https://api.site-mateai.co.uk",    // Backend itself (HTTPS)
        "http://localhost:5173",             // Local dev
        "http://localhost:3000",             // Alternative local dev
      ];

      // Also allow Vercel preview deployments and local development
      if (
        allowedOrigins.indexOf(origin) !== -1 || 
        origin.endsWith(".vercel.app") ||
        origin.startsWith("http://localhost:") ||
        origin.startsWith("http://127.0.0.1:")
      ) {
        callback(null, true);
      } else {
        console.log("Blocked by CORS:", origin);
        callback(new Error("Not allowed by CORS"));
      }
    },
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    credentials: true,
    allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With", "Accept"],
  })
);

app.options(/.*/, cors()); // Enable pre-flight for all routes

app.use((req, res, next) => {
  next();
});

app.use(express.json({ limit: "50mb" }));

// Middleware to ensure DB connection (Crucial for Vercel Serverless)
// app.use(async (req, res, next) => {
//   // Prisma handles connection pool management automatically
//   next();
// });
app.use('/uploads', (req, res, next) => {
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  next();
}, express.static((process.env.NODE_ENV === 'production' || process.env.VERCEL) ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads')));

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

  // Prisma specific error handling could go here
  if (err.code === 'P2002') {
    return res.status(409).json({
      success: false,
      message: `Unique constraint failed on the fields: ${err.meta.target}`
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
      nodeEnv: process.env.NODE_ENV
    }
  });
});

const start = async () => {
  const isProduction = process.env.NODE_ENV === 'production' || process.env.VERCEL;
  const uploadsDir = isProduction ? path.join('/tmp', 'uploads') : path.join(process.cwd(), 'uploads');

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

    // Seed 'Safetynett' client if it doesn't exist
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

    const PORT = process.env.PORT || 4000;
    app.listen(PORT, () => {
      console.log(`Server listening on http://localhost:${PORT}`);
      console.log(`Allowed origin: ${allowedOrigin}`);
    });
  } catch (err) {
    console.error("Failed to start server/db, exiting.", err);
    process.exit(1);
  }
};

if (require.main === module) {
  start();
}

module.exports = app;
