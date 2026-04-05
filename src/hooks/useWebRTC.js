import { useEffect, useState } from 'react'
import webRTCManager from '../services/WebRTCManager'

export function useWebRTC() {
  const [stream, setStream] = useState(null)
  const [connectionState, setConnectionState] = useState('new')

  useEffect(() => {
    webRTCManager.onTrack = (s) => setStream(s)
    webRTCManager.onConnectionChange = (state) => setConnectionState(state)

    webRTCManager.connect().catch(() => {
      setConnectionState('failed')
    })

    return () => {
      webRTCManager.disconnect()
    }
  }, [])

  return { stream, connectionState }
}
