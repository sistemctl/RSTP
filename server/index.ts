import "dotenv/config";
import express from "express";
import pg from "pg";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  defaultCameras,
  validateCameras,
  publicCamera,
  type Camera,
} from "./catalog.js";
const app = express();
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 5000,
});
pool.on("error", () => console.error("Conexión PostgreSQL interrumpida"));
let cameras: Camera[] = defaultCameras();
try {
  cameras = validateCameras(
    JSON.parse(await readFile("config/cameras.local.json", "utf8")),
  );
} catch (e: any) {
  if (e.code !== "ENOENT")
    throw Error("Revise config/cameras.local.json: configuración inválida");
}
await pool.query(
  "CREATE TABLE IF NOT EXISTS cameras (id text PRIMARY KEY, name text NOT NULL, dvr text NOT NULL, brand text NOT NULL, channel integer NOT NULL, enabled boolean NOT NULL)",
);
const client = await pool.connect();
try {
  await client.query("BEGIN");
  await client.query("DELETE FROM cameras");
  for (const c of cameras)
    await client.query(
      "INSERT INTO cameras VALUES ($1,$2,$3,$4,$5,$6)",
      Object.values(publicCamera(c)),
    );
  await client.query("COMMIT");
} catch (e) {
  await client.query("ROLLBACK");
  throw e;
} finally {
  client.release();
}
app.disable("x-powered-by");
app.get("/api/cameras", async (_req, res) => {
  try {
    const result = await pool.query("SELECT * FROM cameras ORDER BY id");
    res.json({
      mode: process.env.LAB_MODE === "false" ? "production" : "lab",
      cameras: result.rows,
    });
  } catch {
    res.status(503).json({ error: "Base de datos no disponible" });
  }
});
app.get("/api/health", async (_req, res) => {
  const checks = await Promise.allSettled([
    pool.query("SELECT 1"),
    fetch("http://127.0.0.1:9997/v3/paths/list", {
      signal: AbortSignal.timeout(2500),
    }).then((r) => {
      if (!r.ok) throw Error();
      return r.json();
    }),
  ]);
  res.json({
    database: checks[0].status === "fulfilled",
    media: checks[1].status === "fulfilled",
    ready:
      checks[1].status === "fulfilled"
        ? checks[1].value.items
            .filter((p: any) => p.ready)
            .map((p: any) => p.name)
        : [],
  });
});
// Only known camera paths are proxied. DVR URLs and credentials never reach the browser.
app.use(
  "/media",
  express.raw({ type: () => true, limit: "128kb" }),
  async (req, res) => {
    const match = req.path.match(
      /^\/(cam-\d{2})(-main)?\/(whep(?:\/[a-zA-Z0-9-]+)?|[a-zA-Z0-9_.-]+)$/,
    );
    if (!match || !cameras.some((c) => c.id === match[1] && c.enabled)) {
      res.sendStatus(404);
      return;
    }
    const webrtc = match[3].startsWith("whep");
    if (
      !["GET", "HEAD", "POST", "PATCH", "DELETE", "OPTIONS"].includes(
        req.method,
      ) ||
      (!webrtc && !["GET", "HEAD"].includes(req.method))
    ) {
      res.sendStatus(405);
      return;
    }
    const headers: Record<string, string> = {};
    for (const h of ["content-type", "if-match", "accept"])
      if (req.headers[h]) headers[h] = String(req.headers[h]);
    try {
      const upstream = await fetch(
        `http://127.0.0.1:${webrtc ? 8889 : 8888}${req.url}`,
        {
          method: req.method,
          headers,
          body: ["POST", "PATCH"].includes(req.method) ? req.body : undefined,
          signal: AbortSignal.timeout(15000),
        },
      );
      res.status(upstream.status);
      for (const h of ["content-type", "etag", "accept-patch"]) {
        const value = upstream.headers.get(h);
        if (value) res.setHeader(h, value);
      }
      const loc = upstream.headers.get("location");
      if (loc)
        res.setHeader(
          "location",
          "/media" + new URL(loc, `http://127.0.0.1:8889${req.url}`).pathname,
        );
      res.setHeader("Cache-Control", "no-store");
      res.send(Buffer.from(await upstream.arrayBuffer()));
    } catch {
      res.status(502).send("Video no disponible");
    }
  },
);
app.use(express.static(path.resolve("dist")));
app.get("/{*path}", (_req, res) =>
  res.sendFile(path.resolve("dist/index.html")),
);
const server = app.listen(Number(process.env.PORT || 3001), "0.0.0.0", () =>
  console.log(`Centinela: http://localhost:${process.env.PORT || 3001}`),
);
async function close() {
  server.close();
  await pool.end();
  process.exit(0);
}
process.on("SIGTERM", close);
process.on("SIGINT", close);
