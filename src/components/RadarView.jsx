import '../styles/RadarView.css'

// ── SVG coordinate constants ──────────────────────────────────────────────────
const SVG_W        = 240
const SVG_H        = 180
const CX           = SVG_W / 2
const CY           = SVG_H          // sensor origin at bottom-centre
const MAX_R        = 110            // SVG units for 30 m
const FOV_HALF_RAD = Math.PI / 3   // 60° → 120° total FOV
const RANGE_RINGS  = [8, 15, 23, 30] // metres

function rangeToRadius(metres) {
  return (metres / 30) * MAX_R
}

function arcPath(r) {
  const sinF = Math.sin(FOV_HALF_RAD)
  const cosF = Math.cos(FOV_HALF_RAD)
  const x1   = (CX - r * sinF).toFixed(1)
  const y1   = (CY - r * cosF).toFixed(1)
  const x2   = (CX + r * sinF).toFixed(1)
  return `M ${x1} ${y1} A ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${x2} ${y1}`
}

function RadarSvg() {
  const sinF = Math.sin(FOV_HALF_RAD)
  const cosF = Math.cos(FOV_HALF_RAD)
  const lx   = (CX - MAX_R * sinF).toFixed(1)
  const ly   = (CY - MAX_R * cosF).toFixed(1)
  const rx   = (CX + MAX_R * sinF).toFixed(1)

  return (
    <svg
      viewBox={`0 0 ${SVG_W} ${SVG_H}`}
      width="100%"
      height="100%"
      preserveAspectRatio="xMidYMid meet"
    >
      {/* FOV sweep area */}
      <path
        d={`M ${CX} ${CY} L ${lx} ${ly} A ${MAX_R} ${MAX_R} 0 0 1 ${rx} ${ly} Z`}
        fill="rgba(30,143,255,0.055)"
      />

      {/* FOV boundary lines */}
      <line x1={CX} y1={CY} x2={lx} y2={ly} stroke="rgba(30,143,255,0.35)" strokeWidth="0.8" />
      <line x1={CX} y1={CY} x2={rx} y2={ly} stroke="rgba(30,143,255,0.35)" strokeWidth="0.8" />

      {/* Range rings with distance labels */}
      {RANGE_RINGS.map(d => {
        const r = rangeToRadius(d)
        return (
          <g key={d}>
            <path d={arcPath(r)} fill="none" stroke="rgba(30,143,255,0.18)" strokeWidth="0.7" />
            <text
              x={(CX + 3).toFixed(1)}
              y={(CY - r + 4).toFixed(1)}
              fill="rgba(160,184,204,0.45)"
              fontSize="7.5"
              fontFamily="monospace"
            >
              {d}m
            </text>
          </g>
        )
      })}

      {/* Sensor origin point */}
      <circle cx={CX} cy={CY} r="5"   fill="none" stroke="rgba(30,143,255,0.2)" strokeWidth="0.8" />
      <circle cx={CX} cy={CY} r="2.5" fill="rgba(30,143,255,0.8)" />

      {/* Spec labels */}
      <text x="6" y="12" fill="rgba(160,184,204,0.5)" fontSize="7.5" fontFamily="monospace">Range: 30 m</text>
      <text x="6" y="22" fill="rgba(160,184,204,0.5)" fontSize="7.5" fontFamily="monospace">FOV: 120°</text>
    </svg>
  )
}

export default function RadarView() {
  return (
    <div className="panel radar-view">
      <div className="panel__header">
        <span className="panel__title">Radar Sensor</span>
        <div className="panel__meta">
          <span className="panel__tag">24 GHz · 120° FOV · 30 m</span>
          <span className="panel__status panel__status--ok">ACTIVE</span>
        </div>
      </div>
      <div className="panel__body radar-view__body">
        <RadarSvg />
      </div>
    </div>
  )
}
