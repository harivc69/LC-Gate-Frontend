import { useEffect, useRef, useState } from 'react'
import webRTCManager from '../services/WebRTCManager'
import '../styles/CameraView.css'

const STATUS_LABEL = {
  connected:    'LIVE',
  connecting:   'CONNECTING',
  new:          'CONNECTING',
  disconnected: 'OFFLINE',
  failed:       'FAULT',
  closed:       'OFFLINE',
}

const STATUS_CLASS = {
  connected:    'panel__status--ok',
  connecting:   'panel__status--warn',
  new:          'panel__status--warn',
  disconnected: 'panel__status--fault',
  failed:       'panel__status--fault',
  closed:       'panel__status--fault',
}

export default function CameraView() {
  const videoRef = useRef(null)
  const [stream, setStream] = useState(null)
  const [connectionState, setConnectionState] = useState('new')

  useEffect(() => {
    webRTCManager.onTrack = (s) => setStream(s)
    webRTCManager.onConnectionChange = (state) => setConnectionState(state)
    webRTCManager.connect().catch(() => setConnectionState('failed'))
    return () => webRTCManager.disconnect()
  }, [])

  useEffect(() => {
    if (videoRef.current && stream) videoRef.current.srcObject = stream
  }, [stream])

  const label = STATUS_LABEL[connectionState] ?? 'OFFLINE'
  const cls   = STATUS_CLASS[connectionState] ?? 'panel__status--fault'

  return (
    <div className="panel camera-view">
      <div className="panel__header">
        <span className="panel__title">Camera Feed</span>
        <div className="panel__meta">
          <span className="panel__tag">CH-01 · RTSP/WebRTC</span>
          <span className={`panel__status ${cls}`}>{label}</span>
        </div>
      </div>
      <div className="panel__body camera-view__body">
        <video ref={videoRef} className="camera-view__feed" autoPlay muted playsInline />
        {!stream && (
          <div className="camera-view__overlay">
            {connectionState === 'failed' ? 'Connection Failed' : 'Connecting…'}
          </div>
        )}
      </div>
    </div>
  )
}
