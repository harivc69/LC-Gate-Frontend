// ── Server configuration ─────────────────────────────────────────────────────
// The fusion server (fusion.py) may run on a different machine.
// Set VITE_SERVER_URL in .env or .env.local to override.
//   e.g.  VITE_SERVER_URL=http://192.168.1.50:8000

const config = {
  serverUrl: import.meta.env.VITE_SERVER_URL || '192.168.1.103:8080',
}

// Derived URLs — video MJPEG streams served by fusion.py
config.cameraStreamUrl = `${config.serverUrl}/video/camera`
config.radarStreamUrl  = `${config.serverUrl}/video/radar`

// WebSocket for fusion zone data
config.fusionWsUrl = config.serverUrl.replace(/^http/, 'ws') + '/ws/fusion'

export default config
