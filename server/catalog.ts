export type Camera = {
  id: string;
  name: string;
  dvr: string;
  brand: string;
  channel: number;
  enabled: boolean;
  source?: string;
  mainSource?: string;
};
export function defaultCameras(): Camera[] {
  return Array.from({ length: 32 }, (_, i) => ({
    id: `cam-${String(i + 1).padStart(2, "0")}`,
    name:
      i < 30 ? `Cámara ${String(i + 1).padStart(2, "0")}` : `Reserva ${i - 29}`,
    dvr:
      i < 22
        ? "Dahua 01"
        : i < 26
          ? "Hikvision 01"
          : i < 30
            ? "Hikvision 02"
            : "Sin asignar",
    brand: i < 22 ? "Dahua" : "Hikvision",
    channel: i < 22 ? i + 1 : i < 26 ? i - 21 : i < 30 ? i - 25 : 0,
    enabled: i < 30,
  }));
}
export function validateCameras(value: unknown): Camera[] {
  if (!Array.isArray(value) || value.length > 32 || !value.length)
    throw Error("Configure entre 1 y 32 cámaras");
  const ids = new Set<string>();
  for (const c of value) {
    if (
      !c ||
      typeof c.id !== "string" ||
      !/^cam-\d{2}$/.test(c.id) ||
      ids.has(c.id) ||
      typeof c.name !== "string" ||
      typeof c.dvr !== "string" ||
      typeof c.brand !== "string" ||
      typeof c.enabled !== "boolean" ||
      !Number.isInteger(c.channel) ||
      c.channel < 0
    )
      throw Error("Configuración de cámaras inválida");
    ids.add(c.id);
    for (const source of [c.source, c.mainSource])
      if (source) {
        const url = new URL(source);
        if (!["rtsp:", "rtsps:"].includes(url.protocol))
          throw Error("Se requiere una fuente RTSP");
      }
  }
  return value;
}
export function publicCamera(c: Camera) {
  return {
    id: c.id,
    name: c.name,
    dvr: c.dvr,
    brand: c.brand,
    channel: c.channel,
    enabled: c.enabled,
  };
}
