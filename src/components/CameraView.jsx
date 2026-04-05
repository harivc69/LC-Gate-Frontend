import '../styles/CameraView.css'

export default function CameraView() {
  return (
    <div className="panel camera-view">
      <div className="panel__header">
        <span className="panel__title">Camera Feed</span>
        <div className="panel__meta">
          <span className="panel__tag">CH-01 · 1080p</span>
          <span className="panel__status panel__status--ok">LIVE</span>
        </div>
      </div>
      <div className="panel__body camera-view__body">
        {/* Video element or canvas will be mounted here by CameraService */}
        <div className="camera-view__feed" />
      </div>
    </div>
  )
}
