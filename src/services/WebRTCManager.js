const SIGNAL_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/offer`

class WebRTCManager {
  constructor() {
    this.pc = null
    this.onTrack = null
    this.onConnectionChange = null
  }

  async connect() {
    this.pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })

    this.pc.ontrack = (evt) => {
      if (this.onTrack) this.onTrack(evt.streams[0])
    }

    this.pc.onconnectionstatechange = () => {
      if (this.onConnectionChange) this.onConnectionChange(this.pc.connectionState)
    }

    // Receive-only — no local media needed
    this.pc.addTransceiver('video', { direction: 'recvonly' })

    const offer = await this.pc.createOffer()
    await this.pc.setLocalDescription(offer)

    // Wait for ICE gathering (with 3 s timeout)
    await Promise.race([
      new Promise((resolve) => {
        if (this.pc.iceGatheringState === 'complete') return resolve()
        this.pc.onicegatheringstatechange = () => {
          if (this.pc.iceGatheringState === 'complete') resolve()
        }
      }),
      new Promise((resolve) => setTimeout(resolve, 3000)),
    ])

    const res = await fetch(SIGNAL_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        sdp: this.pc.localDescription.sdp,
        type: this.pc.localDescription.type,
      }),
    })

    if (!res.ok) throw new Error(`Signaling error: ${res.status}`)

    const answer = await res.json()
    await this.pc.setRemoteDescription(new RTCSessionDescription(answer))
  }

  disconnect() {
    this.pc?.close()
    this.pc = null
    if (this.onConnectionChange) this.onConnectionChange('disconnected')
  }
}

export default new WebRTCManager()
