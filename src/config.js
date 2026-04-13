// ── Server configuration ─────────────────────────────────────────────────────
// The fusion server (fusion.py) may run on a different machine.
// Set VITE_SERVER_URL in .env or .env.local to override.
//   e.g.  VITE_SERVER_URL=http://192.168.1.50:8000

const config = {
  serverUrl: import.meta.env.VITE_SERVER_URL || 'http://192.168.1.100:8000',
  fusionUrl: import.meta.env.VITE_FUSION_URL || 'http://192.168.1.100:8080',
  mcuWsUrl: import.meta.env.VITE_MCU_WS_URL || 'ws://localhost:4500',
  fusionWsUrl: import.meta.env.VITE_FUSION_WS_URL || 'ws://localhost:4501',
  cmdWsUrl: import.meta.env.VITE_CMD_WS_URL || 'ws://localhost:4502',
}

// Derived URLs — video MJPEG streams
config.cameraStreamUrl = `${config.serverUrl}/video/camera`
config.radarStreamUrl = `${config.serverUrl}/video/radar`

export default config
