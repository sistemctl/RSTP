# Centinela · laboratorio CCTV

Web local sin login para 30 cámaras (Dahua: 22, Hikvision: 4 + 4), ampliable a 32. React + TypeScript, Express + TypeScript, PostgreSQL y MediaMTX. Vistas de 4/9/16/32, filtro, búsqueda, páginas, ampliación, WebRTC con alternativa HLS y reconexión.

## Instalación directa en Windows

Requiere Node.js 24, PostgreSQL 18 en `C:/Program Files/PostgreSQL/18/bin` y FFmpeg en PATH. Desde esta carpeta:

```powershell
npm install
npm run setup
npm run build
npm start
```

Abrir http://localhost:3001. Desde la red: `http://IP-DEL-SERVIDOR:3001`. Permitir TCP 3001 y UDP 8189 en el firewall para la red privada. HLS funciona por el puerto web si WebRTC no conecta. No publicar esta aplicación sin login en Internet.

El setup descarga MediaMTX 1.17.0 del repositorio oficial e inicializa un clúster PostgreSQL de laboratorio independiente, en `.runtime/pgdata`, puerto 55432. No modifica el servicio PostgreSQL existente. Usa autenticación `trust` exclusivamente en loopback; cualquier proceso local puede acceder a esta base de laboratorio. Producción debe usar una cuenta propia con contraseña y permisos mínimos. `.env` y `.runtime` no deben versionarse.

`npm start` inicia PostgreSQL de laboratorio, MediaMTX, tres generadores FFmpeg y el servidor web. Ctrl+C los detiene (PostgreSQL solo si fue iniciado por este proceso). Los 30 canales son rutas independientes que reutilizan tres patrones animados, uno por DVR. No representan 30 codificadores distintos y no sustituyen una prueba de carga con DVR reales. Los dos espacios restantes están reservados.

## Configurar cámaras reales

Copiar `config/cameras.example.json` a `config/cameras.local.json` y editar el arreglo de hasta 32 objetos. El archivo se lee al iniciar; reiniciar después de editar. No hay API pública de escritura. El catálogo se sincroniza transaccionalmente a PostgreSQL al arrancar; este archivo es la fuente de verdad. Las URLs RTSP no se guardan en el catálogo público ni se envían al navegador.

```json
[
 {"id":"cam-01","name":"Acceso principal","dvr":"Dahua 01","brand":"Dahua","channel":1,"enabled":true,"source":"rtsp://USUARIO:CLAVE@IP:554/RUTA-SECUNDARIA","mainSource":"rtsp://USUARIO:CLAVE@IP:554/RUTA-PRINCIPAL"},
 {"id":"cam-02","name":"Reserva","dvr":"Sin asignar","brand":"Hikvision","channel":0,"enabled":false}
]
```

Las rutas exactas dependen del DVR. Codificar caracteres especiales de usuario/contraseña con percent-encoding. Probar primero cada fuente en VLC. Configurar substream H.264 para mosaicos y principal H.264 para ampliación; sin `mainSource` se usa `source`. MediaMTX no transcodifica H.265. Audio deshabilitado en la interfaz. En modo laboratorio, las fuentes reales son ignoradas deliberadamente.

Para producción establecer `LAB_MODE=false` y `DATABASE_URL` de una base PostgreSQL real en `.env`. El lanzador dejará de iniciar el clúster de laboratorio y los simuladores. El usuario de PostgreSQL requiere crear/leer/escribir la tabla `cameras`. Los puertos de administración/media HTTP y RTSP quedan en loopback; el backend solo expone rutas de cámaras habilitadas. Las credenciales permanecen en archivos privados del servidor, incluido `.runtime/mediamtx.yml`; restringir sus permisos de Windows. Si se usa HTTPS en producción, terminar TLS en un proxy local hacia el puerto 3001.

## Desarrollo y comprobación

`npm test` verifica distribución, validación y exclusión de credenciales. `npm run build` verifica TypeScript y genera la web. Para recarga de frontend ejecutar `npx vite` mientras `npm start` está activo y abrir el puerto 5173. La API expone `/api/cameras` y `/api/health`. Los estados de cada reproductor se basan en la reproducción, no en datos ficticios. Al ampliar una cámara se cierran los demás reproductores para liberar recursos.

Antes de producción comprobar cada canal, desconexión/reconexión, HLS, acceso LAN, CPU/red y 32 reproducciones en el navegador de destino. No incluye grabaciones, PTZ, descubrimiento ONVIF ni acceso remoto P2P.
