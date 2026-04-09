import '../styles/GateStatusBar.css'

export default function GateStatusBar({
  trainArriving  = false,
  trainDeparting = false,
  manualOverride = false,
}) {
  return (
    <div className={`gsb${manualOverride ? ' gsb--override' : ''}`}>

      <div className={`gsb__indicator ${trainArriving ? 'gsb__indicator--active' : ''}`}>
        <span className="gsb__indicator-label">Train Arriving</span>
      </div>

      <div className={`gsb__indicator ${trainDeparting ? 'gsb__indicator--active' : ''}`}>
        <span className="gsb__indicator-label">Train Departing</span>
      </div>

      <div className="gsb__mode">
        <span className={`gsb__mode-value${manualOverride ? ' gsb__mode-value--fault' : ' gsb__mode-value--ok'}`}>
          {manualOverride ? 'MANUAL OVERRIDE' : 'AUTOMATIC'}
        </span>
      </div>

    </div>
  )
}
