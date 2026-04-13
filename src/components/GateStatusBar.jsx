import '../styles/GateStatusBar.css'

export default function GateStatusBar({
  manualOverride = false,
}) {
  return (
    <div className={`gsb${manualOverride ? ' gsb--override' : ''}`}>

      {/* ── Mode ─────────────────────────────────────────────── */}
      <div className="gsb__mode">
        <span className={`gsb__mode-value${manualOverride ? ' gsb__mode-value--fault' : ' gsb__mode-value--ok'}`}>
          {manualOverride ? 'MANUAL OVERRIDE' : 'AUTOMATIC'}
        </span>
      </div>

    </div>
  )
}
