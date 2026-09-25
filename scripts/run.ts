import "dotenv/config";
import { spawn, execFileSync, type ChildProcess } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { defaultCameras, validateCameras } from "../server/catalog.js";
const lab = process.env.LAB_MODE !== "false";
await mkdir(".runtime", { recursive: true });
let cameras = defaultCameras();
try {
  cameras = validateCameras(
    JSON.parse(await readFile("config/cameras.local.json", "utf8")),
  );
} catch (e: any) {
  if (e.code !== "ENOENT") throw Error("Configuración de cámaras inválida");
}
if (!lab && cameras.some((c) => c.enabled && !c.source))
  throw Error("Faltan fuentes RTSP en config/cameras.local.json");
const pgBin = process.env.PG_BIN || "C:/Program Files/PostgreSQL/18/bin";
let ownPg = false;
if (lab) {
  try {
    execFileSync(`${pgBin}/pg_ctl.exe`, ["status", "-D", ".runtime/pgdata"], {
      stdio: "ignore",
    });
  } catch {
    execFileSync(
      `${pgBin}/pg_ctl.exe`,
      [
        "start",
        "-D",
        ".runtime/pgdata",
        "-l",
        ".runtime/postgres.log",
        "-o",
        "-p 55432 -h 127.0.0.1",
        "-w",
      ],
      { stdio: "inherit" },
    );
    ownPg = true;
  }
}
let config = `logLevel: warn\napi: yes\napiAddress: 127.0.0.1:9997\nrtspAddress: 127.0.0.1:8554\nrtspTransports: [tcp]\nrtmp: no\nsrt: no\nhlsAddress: 127.0.0.1:8888\nhlsVariant: mpegts\nwebrtcAddress: 127.0.0.1:8889\nwebrtcLocalUDPAddress: :8189\nauthInternalUsers:\n  - user: any\n    ips: [127.0.0.1, '::1']\n    permissions:\n      - action: publish\n      - action: read\n      - action: api\npaths:\n`;
if (lab)
  for (let i = 0; i < 3; i++) config += `  lab-${i}:\n    source: publisher\n`;
for (const [i, c] of cameras.entries())
  if (c.enabled) {
    for (const main of [false, true]) {
      const source = lab
        ? `rtsp://127.0.0.1:8554/lab-${i < 22 ? 0 : i < 26 ? 1 : 2}`
        : main
          ? c.mainSource || c.source
          : c.source;
      config += `  ${c.id}${main ? "-main" : ""}:\n    source: ${JSON.stringify(source)}\n    sourceOnDemand: yes\n    rtspTransport: tcp\n`;
    }
  }
await writeFile(".runtime/mediamtx.yml", config);
const children: ChildProcess[] = [];
let stopping = false;
function launch(command: string, args: string[], name: string) {
  const child = spawn(command, args, { windowsHide: true, stdio: "inherit" });
  children.push(child);
  child.on("error", () => {
    console.error(`No se pudo iniciar ${name}`);
    stop(1);
  });
  child.on("exit", (code) => {
    if (!stopping) {
      console.error(`${name} terminó (${code})`);
      stop(1);
    }
  });
  return child;
}
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const c of children) c.kill();
  if (ownPg)
    try {
      execFileSync(
        `${pgBin}/pg_ctl.exe`,
        ["stop", "-D", ".runtime/pgdata", "-m", "fast"],
        { stdio: "ignore" },
      );
    } catch {}
  setTimeout(() => process.exit(code), 500);
}
process.on("SIGINT", () => stop());
process.on("SIGTERM", () => stop());
launch(".runtime/mediamtx.exe", [".runtime/mediamtx.yml"], "MediaMTX");
await new Promise((r) => setTimeout(r, 1500));
if (lab)
  for (let i = 0; i < 3; i++)
    launch(
      "ffmpeg",
      [
        "-hide_banner",
        "-loglevel",
        "error",
        "-re",
        "-f",
        "lavfi",
        "-i",
        `testsrc2=size=640x360:rate=10`,
        `-vf`,
        `hue=h=${i * 90}`,
        "-an",
        "-c:v",
        "libx264",
        "-preset",
        "ultrafast",
        "-tune",
        "zerolatency",
        "-pix_fmt",
        "yuv420p",
        "-profile:v",
        "baseline",
        "-g",
        "10",
        "-bf",
        "0",
        "-threads",
        "1",
        "-f",
        "rtsp",
        "-rtsp_transport",
        "tcp",
        `rtsp://127.0.0.1:8554/lab-${i}`,
      ],
      `Simulador ${i + 1}`,
    );
launch(process.execPath, ["--import", "tsx", "server/index.ts"], "API");
