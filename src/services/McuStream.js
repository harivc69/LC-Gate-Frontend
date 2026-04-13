// WebSocket consumer for MCU data via the mcu-bridge.
// Bridge connects to MCU TCP (192.168.1.200:8888) and re-broadcasts
// newline-delimited JSON over ws://localhost:4500

const RETRY_DELAY_MS = 3000
const STALE_TIMEOUT_MS = 10000

export class McuStream {
  constructor({ onData, onStatus } = {}) {
    this.onData   = onData   || (() => {})
    this.onStatus = onStatus || (() => {})
    this._ws         = null
    this._retryTimer = null
    this._staleTimer = null
    this._active     = false
    this._url        = null
  }

  connect(wsUrl) {
    this._active = true
    this._url = wsUrl
    this._open()
  }

  disconnect() {
    this._active = false
    clearTimeout(this._retryTimer)
    clearTimeout(this._staleTimer)
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
  }

  _resetStaleTimer() {
    clearTimeout(this._staleTimer)
    this._staleTimer = setTimeout(() => {
      this.onStatus('stale')
      if (this._ws) {
        this._ws.close()
        this._ws = null
      }
    }, STALE_TIMEOUT_MS)
  }

  _open() {
    if (!this._active) return
    this.onStatus('connecting')

    const ws = new WebSocket(this._url)
    this._ws = ws

    ws.onopen = () => {
      this._resetStaleTimer()
      this.onStatus('open')
    }

    ws.onmessage = (evt) => {
      this._resetStaleTimer()
      try {
        const data = JSON.parse(evt.data)
        if (data.type === 'ping') return
        this.onData(data)
      } catch { /* skip malformed */ }
    }

    ws.onerror = () => {
      clearTimeout(this._staleTimer)
      this.onStatus('error')
    }

    ws.onclose = () => {
      clearTimeout(this._staleTimer)
      this.onStatus('closed')
      this._ws = null
      if (this._active) {
        this._retryTimer = setTimeout(() => this._open(), RETRY_DELAY_MS)
      }
    }
  }
}
