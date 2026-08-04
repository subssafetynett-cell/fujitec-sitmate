import cors from "cors";
import dotenv from "dotenv";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { initDatabase } from "./db/migrate.js";
import { sheqRouter } from "./routes/sheq.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load root .env first, then backend/.env overrides
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

const app = express();
const port = Number(process.env.BACKEND_PORT || process.env.PORT || 4000);
const corsOrigin = process.env.CORS_ORIGIN || "http://localhost:8080";

app.use(helmet());
app.use(
  cors({
    origin: corsOrigin.split(",").map((o) => o.trim()),
    credentials: true,
  }),
);
app.use(morgan(process.env.NODE_ENV === "production" ? "combined" : "dev"));
app.use(express.json({ limit: "6mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    service: "sheq-harmony-backend",
    timestamp: new Date().toISOString(),
  });
});

app.use("/api/sheq", sheqRouter);

app.use((_req, res) => {
  res.status(404).json({ error: "Not found" });
});

app.use(
  (
    err: Error,
    _req: express.Request,
    res: express.Response,
    _next: express.NextFunction,
  ) => {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  },
);

async function start() {
  try {
    await initDatabase();
    console.log("PostgreSQL connected and schema ready");
  } catch (err) {
    console.error("Failed to initialize PostgreSQL:", err);
    process.exit(1);
  }

  app.listen(port, "0.0.0.0", () => {
    console.log(`SHEQ backend listening on http://0.0.0.0:${port}`);
  });
}

void start();
