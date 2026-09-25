import { useEffect, useRef, useState } from "react";
import type Hls from "hls.js";
export function Player({ id, main = false }: { id: string; main?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [status, setStatus] = useState("Conectando");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let disposed = false;
    let pc: RTCPeerConnection | undefined;
    let hls: Hls | undefined;
    let session: string | undefined;
    let timer: ReturnType<typeof setTimeout>;
    let watchdog: ReturnType<typeof setTimeout>;
    let fallbackUsed = false;
    const abort = new AbortController();
    const base = `/media/${id}${main ? "-main" : ""}`;
    setStatus("Conectando");
    const reconnect = () => {
      if (disposed) return;
      setStatus("Sin señal · reintentando");
      clearTimeout(timer);
      timer = setTimeout(() => setRetry((x) => x + 1), 10000);
    };
    const fallback = async () => {
      if (disposed || fallbackUsed) return;
      fallbackUsed = true;
      clearTimeout(watchdog);
      pc?.close();
      if (session) void fetch(session, { method: "DELETE" }).catch(() => {});
      setStatus("Conectando HLS");
      const el = video.current;
      if (!el) return;
      el.srcObject = null;
      const url = `${base}/index.m3u8`;
      const module = await import("hls.js").catch(() => null);
      if (!module) {
        reconnect();
        return;
      }
      const { default: Hls } = module;
      if (disposed) return;
      if (Hls.isSupported()) {
        hls = new Hls({ liveSyncDurationCount: 2 });
        hls.loadSource(url);
        hls.attachMedia(el);
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
          if (!disposed) void el.play().catch(reconnect);
        });
        hls.on(Hls.Events.ERROR, (_, data) => {
          if (data.fatal) reconnect();
        });
      } else if (el.canPlayType("application/vnd.apple.mpegurl")) {
        el.src = url;
        void el.play().catch(reconnect);
      } else reconnect();
    };
    const start = async () => {
      try {
        pc = new RTCPeerConnection({ iceServers: [] });
        pc.addTransceiver("video", { direction: "recvonly" });
        pc.ontrack = (e) => {
          if (!disposed && video.current) {
            video.current.srcObject = new MediaStream([e.track]);
            void video.current.play().catch(fallback);
          }
        };
        pc.onconnectionstatechange = () => {
          if (pc?.connectionState === "connected") clearTimeout(watchdog);
          if (
            pc?.connectionState === "failed" ||
            pc?.connectionState === "disconnected"
          )
            fallback();
        };
        await pc.setLocalDescription(await pc.createOffer());
        await new Promise<void>((resolve) => {
          if (pc!.iceGatheringState === "complete") return resolve();
          const timeout = setTimeout(resolve, 2000);
          pc!.onicegatheringstatechange = () => {
            if (pc!.iceGatheringState === "complete") {
              clearTimeout(timeout);
              resolve();
            }
          };
        });
        if (disposed) return;
        const response = await fetch(`${base}/whep`, {
          method: "POST",
          headers: { "Content-Type": "application/sdp" },
          body: pc.localDescription!.sdp,
          signal: AbortSignal.any([abort.signal, AbortSignal.timeout(30000)]),
        });
        if (!response.ok) throw Error();
        session = response.headers.get("location") || undefined;
        if (disposed || fallbackUsed) {
          if (session)
            void fetch(session, { method: "DELETE" }).catch(() => {});
          return;
        }
        await pc.setRemoteDescription({
          type: "answer",
          sdp: await response.text(),
        });
        if (pc.connectionState !== "connected")
          watchdog = setTimeout(fallback, 12000);
      } catch (error) {
        if (!disposed) console.debug(`${id}: usando alternativa HLS`, error);
        if (!disposed) fallback();
      }
    };
    void start();
    return () => {
      disposed = true;
      abort.abort();
      clearTimeout(timer);
      clearTimeout(watchdog);
      pc?.close();
      hls?.destroy();
      if (session) void fetch(session, { method: "DELETE" }).catch(() => {});
      const el = video.current;
      if (el) {
        el.pause();
        el.srcObject = null;
        el.removeAttribute("src");
        el.load();
      }
    };
  }, [id, main, retry]);
  return (
    <>
      <video
        ref={video}
        autoPlay
        muted
        playsInline
        onPlaying={() => setStatus("En vivo")}
        onWaiting={() => setStatus("Cargando")}
        onStalled={() => setStatus("Cargando")}
        onError={() => setStatus("Sin señal")}
      />
      <span className={`signal ${status === "En vivo" ? "live" : ""}`}>
        <i />
        {status}
      </span>
    </>
  );
}
