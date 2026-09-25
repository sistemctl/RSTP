import { test } from "node:test";
import assert from "node:assert/strict";
import {
  defaultCameras,
  validateCameras,
  publicCamera,
} from "../server/catalog.js";
test("30 cámaras distribuidas en tres DVR y dos reservas", () => {
  const c = defaultCameras();
  assert.equal(c.length, 32);
  assert.equal(c.filter((c) => c.enabled).length, 30);
  assert.equal(c.filter((c) => c.dvr === "Dahua 01").length, 22);
  assert.equal(c.filter((c) => c.dvr === "Hikvision 01").length, 4);
  assert.equal(c.filter((c) => c.dvr === "Hikvision 02").length, 4);
});
test("rechaza IDs duplicados y fuentes no RTSP", () => {
  const c = defaultCameras();
  assert.throws(() => validateCameras([c[0], c[0]]));
  assert.throws(() =>
    validateCameras([{ ...c[0], source: "http://example.com" }]),
  );
});
test("credenciales nunca se incluyen en la respuesta pública", () => {
  const c = {
    ...defaultCameras()[0],
    source: "rtsp://user:secret@192.168.1.20/live",
    mainSource: "rtsp://user:secret@192.168.1.20/main",
  };
  assert.ok(!JSON.stringify(publicCamera(c)).includes("secret"));
  assert.equal(validateCameras([c])[0].source, c.source);
});
