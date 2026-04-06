// MediaMTX WHEP endpoint — mediamtx handles ICE/STUN internally
// WHEP = WebRTC-HTTP Egress Protocol (standardised pull signaling)
// Default mediamtx WHEP port: 8889  |  stream path: /cam/whep  (configure in mediamtx.yml)
const WHEP_URL = `${import.meta.env.VITE_MEDIAMTX_URL || 'http://localhost:8889'}/cam/whep`

const RETRY_DELAY_MS = 5000

class WebRTCManager {
  constructor() {
    this.pc          = null
    this.onTrack     = null
    this.onConnectionChange = null
    this._active     = false
    this._retryTimer = null
  }

  // ── Public API ──────────────────────────────────────────────────────────────

  connect() {
    this._active = true
    return this._attempt()
  }

  disconnect() {
    this._active = false
    clearTimeout(this._retryTimer)
    this._closePc()
    this.onConnectionChange?.('disconnected')
  }

  // ── Internal ────────────────────────────────────────────────────────────────

  async _attempt() {
    if (!this._active) return
    try {
      await this._setup()
    } catch {
      this._scheduleRetry()
    }
  }

  async _setup() {
    this._closePc()

    // No STUN needed for LAN; mediamtx handles ICE on server side.
    // For cloud, point VITE_MEDIAMTX_URL at your public mediamtx host —
    // configure iceServers in mediamtx.yml instead of here.
    this.pc = new RTCPeerConnection()

    this.pc.ontrack = (evt) => {
      this.onTrack?.(evt.streams[0])
    }

    this.pc.onconnectionstatechange = () => {
      const state = this.pc?.connectionState
      if (!state) return
      this.onConnectionChange?.(state)

      if (state === 'failed' || state === 'disconnected') {
        this._closePc()
        this._scheduleRetry()
      }
    }

    // Receive-only — camera stream, no local media captured
    this.pc.addTransceiver('video', { direction: 'recvonly' })
    this.pc.addTransceiver('audio', { direction: 'recvonly' })

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    // Wait for ICE gathering (max 3 s) before sending offer
    await this._waitForIce()

    // WHEP signaling: POST raw SDP, get raw SDP answer back
    const res = await fetch(WHEP_URL, {
      method:  'POST',
      headers: { 'Content-Type': 'application/sdp' },
      body:    this.pc.localDescription.sdp,
    })

    if (!res.ok) throw new Error(`WHEP ${res.status}`)

    const answerSdp = await res.text()
    await this.pc.setRemoteDescription({ type: 'answer', sdp: answerSdp })
  }

  _waitForIce() {
    return Promise.race([
      new Promise((resolve) => {
        if (this.pc.iceGatheringState === 'complete') return resolve()
        this.pc.onicegatheringstatechange = () => {
          if (this.pc.iceGatheringState === 'complete') resolve()
        }
      }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])
  }

  _scheduleRetry() {
    if (!this._active) return
    this._retryTimer = setTimeout(() => this._attempt(), RETRY_DELAY_MS)
  }

  _closePc() {
    this.pc?.close()
    this.pc = null
  }
}

export default new WebRTCManager()
