import { useEffect, useCallback } from 'react'
import '../styles/FullscreenViewer.css'

export default function FullscreenViewer({ title, streamUrl, onClose }) {
  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') onClose()
  }, [onClose])

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [handleKeyDown])

  return (
    <div className="fullscreen-viewer" onClick={onClose}>
      <div className="fullscreen-viewer__content" onClick={(e) => e.stopPropagation()}>
        <div className="fullscreen-viewer__header">
          <span className="fullscreen-viewer__title">{title}</span>
          <button className="fullscreen-viewer__close" onClick={onClose} aria-label="Close">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>
        <div className="fullscreen-viewer__body">
          {streamUrl ? (
            <img src={streamUrl} className="fullscreen-viewer__feed" alt={title} />
          ) : (
            <div className="fullscreen-viewer__empty">No Feed Available</div>
          )}
        </div>
      </div>
    </div>
  )
}
