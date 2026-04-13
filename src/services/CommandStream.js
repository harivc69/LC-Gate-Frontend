// WebSocket client for sending commands to MCU via cmd-bridge.
// Connects to ws://localhost:4502 and sends JSON payloads.

const RETRY_DELAY_MS = 3000

export class CommandStream {
  constructor() {
    this._ws = null
    this._retryTimer = null
    this._active = false
    this._url = null
  }

  connect(wsUrl) {
    this._active = true
    this._url = wsUrl || 'ws://localhost:4502'
    this._open()
  }

  disconnect() {
    this._active = false
    clearTimeout(this._retryTimer)
    if (this._ws) {
      this._ws.close()
      this._ws = null
    }
  }

  /** Send a JSON command. Returns true if the socket was open. */
  send(data) {
    if (this._ws && this._ws.readyState === WebSocket.OPEN) {
      this._ws.send(JSON.stringify(data))
      return true
    }
    return false
  }

  _open() {
    if (!this._active) return
    const ws = new WebSocket(this._url)
    this._ws = ws

    ws.onopen = () => console.log('[CMD] Connected')
    ws.onerror = () => console.log('[CMD] Error')

    ws.onclose = () => {
      this._ws = null
      if (this._active) {
        this._retryTimer = setTimeout(() => this._open(), RETRY_DELAY_MS)
      }
    }
  }
}
