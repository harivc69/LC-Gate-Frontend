// WebSocket consumer for the fusion zone data stream.
// Backend pushes a JSON frame every ~33 ms via /ws/fusion.
//
// Payload shape:
//   { timestamp, camera_zones, radar_zones, fusion_zones }
//   where each *_zones is { CZ1, CZ2, IZ1, IZ2, TZ1, TZ2 } → integer counts

const RETRY_DELAY_MS = 5000
const STALE_TIMEOUT_MS = 3000  // no message for 3 s → connection is dead

export class FusionStream {
  constructor({ onData, onStatus } = {}) {
    this.onData   = onData   || (() => {})
    this.onStatus = onStatus || (() => {})
    this._ws          = null
    this._retryTimer  = null
    this._staleTimer  = null
    this._active      = false
    this._url         = null
    this._alive       = false  // true while messages are flowing
  }

  connect(apiBase) {
    this._active = true
    this._url = (apiBase || 'http://localhost:8000')
      .replace(/^http/, 'ws') + '/ws/fusion'
    this._open()
  }

  disconnect() {
    this._active = false
    clearTimeout(this._retryTimer)
    this._clearStaleTimer()
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
  }

  _resetStaleTimer() {
    clearTimeout(this._staleTimer)
    this._staleTimer = setTimeout(() => {
      // No message received within the timeout — treat as dead
      this._alive = false
      this.onStatus('stale')
      // Force-close the zombie socket so onclose triggers a reconnect
      if (this._ws) {
        this._ws.close()
        this._ws = null
      }
    }, STALE_TIMEOUT_MS)
  }

  _clearStaleTimer() {
    clearTimeout(this._staleTimer)
    this._staleTimer = null
  }

  _open() {
    if (!this._active) return
    this._alive = false
    this.onStatus('connecting')

    const ws = new WebSocket(this._url)
    this._ws = ws

    ws.onopen = () => {
      this._alive = true
      this._resetStaleTimer()
      this.onStatus('open')
    }

    ws.onmessage = (evt) => {
      this._alive = true
      this._resetStaleTimer()
      try {
        const data = JSON.parse(evt.data)
        if (data.type === 'ping') return   // keepalive — ignore
        this.onData(data)
      } catch {
        // malformed frame — skip
      }
    }

    ws.onerror = () => {
      this._alive = false
      this._clearStaleTimer()
      this.onStatus('error')
    }

    ws.onclose = () => {
      this._alive = false
      this._clearStaleTimer()
      this.onStatus('closed')
      this._ws = null
      if (this._active) {
        this._retryTimer = setTimeout(() => this._open(), RETRY_DELAY_MS)
      }
    }
  }
}
