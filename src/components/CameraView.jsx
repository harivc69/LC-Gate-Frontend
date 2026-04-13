import { useState, useEffect, useRef } from 'react'
import '../styles/CameraView.css'
import FullscreenViewer from './FullscreenViewer'
import { PROBE_INTERVAL, PROBE_TIMEOUT } from '../defaults'

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function CameraView({ title = 'Camera Feed', streamUrl = null, onFeedStatus }) {
  const [fullscreen, setFullscreen] = useState(false)
  const [feedAlive, setFeedAlive] = useState(false)
  const onFeedStatusRef = useRef(onFeedStatus)
  onFeedStatusRef.current = onFeedStatus

  const setAlive = (alive) => {
    setFeedAlive(alive)
    onFeedStatusRef.current?.(alive)
  }

  // Periodic fetch-based probe — works reliably with MJPEG streams
  useEffect(() => {
    if (!streamUrl) { setAlive(false); return }

    let active = true

    const checkFeed = async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT)
      try {
        await fetch(streamUrl, { mode: 'no-cors', signal: controller.signal })
        clearTimeout(timeout)
        controller.abort()               // stop reading MJPEG body
        if (active) setAlive(true)
      } catch {
        clearTimeout(timeout)
        if (active) setAlive(false)
      }
    }

    checkFeed()
    const interval = setInterval(checkFeed, PROBE_INTERVAL)
    return () => { active = false; clearInterval(interval) }
  }, [streamUrl])

  return (
    <div className="panel camera-view">
      <div className="panel__header">
        <span className="panel__title">{title}</span>
        <div className="panel__meta">
          <button
            className="panel__fullscreen-btn"
            onClick={() => setFullscreen(true)}
            aria-label="View fullscreen"
            title="Fullscreen"
          >
            <EyeIcon />
          </button>
          <span className={`panel__status ${feedAlive ? 'panel__status--ok' : 'panel__status--fault'}`}>
            {feedAlive ? 'ACTIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
      <div className="panel__body camera-view__body">
        {streamUrl && feedAlive ? (
          <img
            src={streamUrl}
            className="camera-view__feed"
            alt={title}
            onLoad={() => setAlive(true)}
            onError={() => setAlive(false)}
          />
        ) : (
          <div className="camera-view__overlay">{streamUrl ? 'Not Connected' : 'Not Installed'}</div>
        )}
      </div>

      {fullscreen && (
        <FullscreenViewer
          title={title}
          streamUrl={streamUrl}
          onClose={() => setFullscreen(false)}
        />
      )}
    </div>
  )
}
