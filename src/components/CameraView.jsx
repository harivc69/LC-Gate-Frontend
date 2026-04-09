import { useState } from 'react'
import '../styles/CameraView.css'
import FullscreenViewer from './FullscreenViewer'

function EyeIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

export default function CameraView({ title = 'Camera Feed', streamUrl = null }) {
  const [fullscreen, setFullscreen] = useState(false)

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
          <span className={`panel__status ${streamUrl ? 'panel__status--ok' : 'panel__status--fault'}`}>
            {streamUrl ? 'LIVE' : 'OFFLINE'}
          </span>
        </div>
      </div>
      <div className="panel__body camera-view__body">
        {streamUrl ? (
          <img src={streamUrl} className="camera-view__feed" alt={title} />
        ) : (
          <div className="camera-view__overlay">Not Installed</div>
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
