import React, { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Camera,
  Shield,
  Grid2X2,
  Maximize2,
  ChevronLeft,
  ChevronRight,
  Search,
  Radio,
  Server,
  X,
  Expand,
  RefreshCw,
} from "lucide-react";
import { Player } from "./Player";
import "./style.css";
type Cam = {
  id: string;
  name: string;
  dvr: string;
  brand: string;
  channel: number;
  enabled: boolean;
};
function App() {
  const [cameras, setCameras] = useState<Cam[]>([]);
  const [mode, setMode] = useState("lab");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [size, setSize] = useState(9);
  const [group, setGroup] = useState("Todos los equipos");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [selected, setSelected] = useState<Cam | null>(null);
  const [health, setHealth] = useState({ database: false, media: false });
  const [now, setNow] = useState(new Date());
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    fetch("/api/cameras")
      .then((r) => {
        if (!r.ok) throw Error();
        return r.json();
      })
      .then((data) => {
        if (active) {
          setCameras(data.cameras);
          setMode(data.mode);
          setError("");
          setLoading(false);
        }
      })
      .catch(() => {
        if (active) setLoading(false);
        if (active)
          setError(
            "No se pudo cargar el catálogo. Comprueba el servidor y PostgreSQL.",
          );
      });
    const tick = async () => {
      try {
        const r = await fetch("/api/health");
        if (!r.ok) throw Error();
        const h = await r.json();
        if (active) setHealth(h);
      } catch {
        if (active) setHealth({ database: false, media: false });
      }
    };
    void tick();
    const interval = setInterval(tick, 10000);
    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [reload]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    const fn = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSelected(null);
    };
    window.addEventListener("keydown", fn);
    return () => window.removeEventListener("keydown", fn);
  }, []);
  const groups = [
    "Todos los equipos",
    ...new Set(cameras.filter((c) => c.enabled).map((c) => c.dvr)),
  ];
  const filtered = cameras.filter(
    (c) =>
      (group === "Todos los equipos" || c.dvr === group) &&
      `${c.name} ${c.id} ${c.dvr}`.toLowerCase().includes(search.toLowerCase()),
  );
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const visible = filtered.slice(page * size, (page + 1) * size);
  const changeSize = (n: number) => {
    setSize(n);
    setPage(0);
  };
  return (
    <div className="shell">
      <aside inert={selected !== null}>
        <a className="brand" href="/" aria-label="Centinela inicio">
          <Shield size={27} />
          <span>
            CENTINELA<small>VIDEO MONITOR</small>
          </span>
        </a>
        <div className="workspace-label">ESPACIO DE TRABAJO</div>
        <div className="active-nav">
          <Grid2X2 size={18} />
          Monitoreo en vivo
          <span>{cameras.filter((c) => c.enabled).length}</span>
        </div>
        <div className="equipment-heading">
          EQUIPOS <span>{String(groups.length - 1).padStart(2, "0")}</span>
        </div>
        <nav>
          {groups.map((g, i) => (
            <button
              key={g}
              className={g === group ? "chosen" : ""}
              onClick={() => {
                setGroup(g);
                setPage(0);
              }}
            >
              {i === 0 ? <Grid2X2 size={16} /> : <Server size={16} />}
              <span>
                {g}
                {i > 0 && (
                  <small>
                    {cameras.filter((c) => c.dvr === g && c.enabled).length}{" "}
                    cámaras configuradas
                  </small>
                )}
              </span>
              <b>
                {i === 0
                  ? cameras.filter((c) => c.enabled).length
                  : cameras.filter((c) => c.dvr === g && c.enabled).length}
              </b>
            </button>
          ))}
        </nav>
        <div className="lab-note">
          <Radio size={19} />
          <strong>{mode === "lab" ? "Laboratorio activo" : "Red local"}</strong>
          <p>
            {mode === "lab"
              ? "Señales de prueba. Listo para conectar tus DVR."
              : "Visualización directa de tus equipos."}
          </p>
        </div>
        <div className="sidebar-bottom">
          <span className={health.media ? "dot" : "dot offline"} />
          {health.media
            ? "Servidor de video disponible"
            : "Servidor de video sin conexión"}
        </div>
      </aside>
      <main inert={selected !== null}>
        <header>
          <div className="breadcrumb">
            CENTRO DE CONTROL <span>/</span> VISTA GENERAL
          </div>
          <div className="clock">
            <span>
              {now.toLocaleDateString("es-CO", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </span>
            <b>{now.toLocaleTimeString("es-CO", { hour12: false })}</b>
          </div>
        </header>
        <section className="heading">
          <div>
            <div className="eyebrow">
              <span className="dot" /> SUPERVISIÓN EN TIEMPO REAL
            </div>
            <h1>
              Monitoreo en vivo<span>.</span>
            </h1>
            <p>Tus cámaras, en un solo lugar.</p>
          </div>
          <div className="summary">
            <div>
              <strong>
                {cameras
                  .filter((c) => c.enabled)
                  .length.toString()
                  .padStart(2, "0")}
              </strong>
              <span>CONFIGURADAS</span>
            </div>
            <div>
              <strong>{String(groups.length - 1).padStart(2, "0")}</strong>
              <span>GRABADORES</span>
            </div>
            <div>
              <strong>32</strong>
              <span>CAPACIDAD</span>
            </div>
          </div>
        </section>
        <section className="toolbar" aria-label="Controles del mosaico">
          <div className="view-picker">
            <Grid2X2 size={16} />
            <span>Vista</span>
            {[4, 9, 16, 32].map((n) => (
              <button
                key={n}
                onClick={() => changeSize(n)}
                className={size === n ? "selected" : ""}
                aria-pressed={size === n}
              >
                {n}
              </button>
            ))}
          </div>
          <label className="search">
            <Search size={16} />
            <input
              placeholder="Buscar cámara..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(0);
              }}
              aria-label="Buscar cámara"
            />
          </label>
          <button
            className="icon-button"
            title="Recargar conexiones"
            aria-label="Recargar conexiones"
            onClick={() => setReload((r) => r + 1)}
          >
            <RefreshCw size={17} />
          </button>
          <button
            className="icon-button"
            title="Pantalla completa"
            aria-label="Pantalla completa"
            onClick={() => {
              if (document.fullscreenElement) void document.exitFullscreen();
              else
                void document.documentElement
                  .requestFullscreen()
                  .catch(() => {});
            }}
          >
            <Expand size={18} />
          </button>
        </section>
        <div className="mosaic-heading">
          <span>
            {group}
            <b>{mode === "lab" ? "SIMULACIÓN" : "EN DIRECTO"}</b>
          </span>
          <small>
            {filtered.length
              ? `${page * size + 1}–${Math.min((page + 1) * size, filtered.length)}`
              : "0"}{" "}
            de {filtered.length} posiciones
          </small>
        </div>
        {error ? (
          <div className="empty-state">
            {error}
            <button onClick={() => setReload((r) => r + 1)}>Reintentar</button>
          </div>
        ) : loading ? (
          <div className="empty-state">Cargando cámaras…</div>
        ) : !visible.length ? (
          <div className="empty-state">
            No hay cámaras que coincidan con tu búsqueda.
          </div>
        ) : (
          <section className={`mosaic size-${size}`} aria-label="Cámaras">
            {visible.map((c) => (
              <article
                className={`camera ${!c.enabled ? "reserved" : ""}`}
                key={`${c.id}-${reload}`}
              >
                <div className="video-area">
                  {c.enabled ? (
                    <>
                      {!selected && <Player id={c.id} />}
                      <span className="channel">
                        {c.id.replace("cam-", "CH ")}
                      </span>
                      {mode === "lab" && (
                        <span className="simulation">SEÑAL DE PRUEBA</span>
                      )}
                      <button
                        className="expand-camera"
                        onClick={() => setSelected(c)}
                        aria-label={`Ampliar ${c.name}`}
                      >
                        <Maximize2 size={17} />
                      </button>
                    </>
                  ) : (
                    <div className="reserve-content">
                      <Camera size={25} />
                      <strong>Espacio disponible</strong>
                      <span>Para tu próxima cámara</span>
                    </div>
                  )}
                </div>
                <footer>
                  <span>
                    <i className={c.enabled ? "dot" : "dot offline"} />
                    {c.name}
                  </span>
                  <small>{c.enabled ? c.dvr : "Sin asignar"}</small>
                </footer>
              </article>
            ))}
          </section>
        )}
        <div className="pagination">
          <span>
            <span className="dot" />{" "}
            {mode === "lab"
              ? "Modo laboratorio · video simulado"
              : "Conexión local"}
            <em>Sin grabación</em>
          </span>
          <div>
            <button
              aria-label="Página anterior"
              disabled={page === 0}
              onClick={() => setPage((p) => p - 1)}
            >
              <ChevronLeft size={17} />
            </button>
            <span>
              {page + 1} / {pages}
            </span>
            <button
              aria-label="Página siguiente"
              disabled={page >= pages - 1}
              onClick={() => setPage((p) => p + 1)}
            >
              <ChevronRight size={17} />
            </button>
          </div>
        </div>
        <footer className="system-footer">
          <span>
            CENTINELA <b>/</b> LOCAL VIDEO WORKSPACE
          </span>
          <span>
            PostgreSQL <i className={health.database ? "dot" : "dot offline"} />{" "}
            · MediaMTX <i className={health.media ? "dot" : "dot offline"} />
          </span>
        </footer>
      </main>
      {selected && (
        <div
          className="modal"
          role="dialog"
          aria-modal="true"
          aria-label={selected.name}
        >
          <div className="modal-header">
            <div>
              <strong>{selected.name}</strong>
              <span>
                {selected.dvr} · Canal {selected.channel} · Flujo principal
              </span>
            </div>
            <button
              autoFocus
              aria-label="Cerrar cámara"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
          </div>
          <div className="modal-video">
            <Player id={selected.id} main />
          </div>
          <p>Esc para volver al mosaico</p>
        </div>
      )}
    </div>
  );
}
createRoot(document.getElementById("root")!).render(<App />);
