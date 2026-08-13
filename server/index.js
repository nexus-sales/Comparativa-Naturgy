import express from "express";
import compression from "compression";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cookie from "cookie";
import { pool } from "./db.js";
import { COOKIE_NAME, verifySessionToken } from "./auth.js";
import { authRouter } from "./routes/auth.js";
import { segmentsRouter } from "./routes/segments.js";
import { tariffsRouter } from "./routes/tariffs.js";
import { comparisonsRouter } from "./routes/comparisons.js";
import { noticesRouter } from "./routes/notices.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DIST_DIR = path.join(__dirname, "..", "dist");
const PORT = parseInt(process.env.PORT, 10) || 3000;

for (const name of ["DATABASE_URL", "ADMIN_PASSWORD", "SESSION_SECRET"]) {
  if (!process.env[name]) {
    console.error(`Falta la variable de entorno ${name}`);
    process.exit(1);
  }
}

const app = express();
app.set("trust proxy", 1); // Dokploy sits behind a reverse proxy — needed for req.ip

// Vercel compressed responses at the CDN automatically; our own Express
// server doesn't unless told to. Without this the ~1.1MB main JS bundle
// goes out raw instead of ~350KB gzipped — on a modest VPS uplink that's
// the difference between the app loading and the browser hanging on it.
app.use(compression());

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  if (req.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  next();
});

app.use(express.json({ limit: "2mb" }));

app.use((req, res, next) => {
  const cookies = cookie.parse(req.headers.cookie ?? "");
  req.authenticated = verifySessionToken(cookies[COOKIE_NAME]);
  next();
});

function requireAuth(req, res, next) {
  if (!req.authenticated) return res.status(401).json({ error: "No autenticado." });
  next();
}

app.use("/api/auth", authRouter);
app.use("/api/segments", requireAuth, segmentsRouter);
app.use("/api/tariffs", requireAuth, tariffsRouter);
app.use("/api/comparisons", requireAuth, comparisonsRouter);
app.use("/api/notices", requireAuth, noticesRouter);

app.use((err, req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Error interno del servidor." });
});

app.use(express.static(DIST_DIR));
app.get(/^(?!\/api\/).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, "index.html"));
});

const server = app.listen(PORT, "0.0.0.0", () => {
  console.log(`Naturgy comparativa escuchando en 0.0.0.0:${PORT}`);
});

async function shutdown(signal) {
  console.log(`${signal} recibido, cerrando servidor...`);
  server.close(async () => {
    await pool.end();
    process.exit(0);
  });
  // Force-exit if close hangs (open keep-alive connections, etc).
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
