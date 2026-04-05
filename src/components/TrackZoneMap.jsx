import '../styles/TrackZoneMap.css'

// ── SVG layout constants ──────────────────────────────────────────────────────
const SVG_W   = 320
const SVG_H   = 408
const ROAD_W  = 80
const ROAD_L  = (SVG_W - ROAD_W) / 2   // 120  left road edge
const ROAD_R  = ROAD_L + ROAD_W         // 200  right road edge
const ROAD_CX = SVG_W / 2              // 160  road centre

// Zone bands (top to bottom, symmetric around track)
const ZONE_BANDS = [
  { labels: ['TZ-1', 'TZ-2'], y: 0,   h: 65,  fill: '#091e1e' },
  { labels: ['IZ-1', 'IZ-2'], y: 65,  h: 58,  fill: '#112d2d' },
  { labels: ['CZ-1', 'CZ-2'], y: 123, h: 50,  fill: '#102c18' },
  { labels: ['CZ-3', 'CZ-4'], y: 235, h: 50,  fill: '#102c18' },
  { labels: ['IZ-3', 'IZ-4'], y: 285, h: 58,  fill: '#112d2d' },
  { labels: ['TZ-3', 'TZ-4'], y: 343, h: 65,  fill: '#091e1e' },
]

const TRACK_Y   = 173   // rail track band top Y
const TRACK_H   = 62    // rail track band height
const BARRIER_T = 123   // top barrier Y
const BARRIER_B = 285   // bottom barrier Y
const PIVOT_W   = 18
const PIVOT_H   = 8

// ── Sub-components ────────────────────────────────────────────────────────────

function ZoneBands() {
  return (
    <>
      {ZONE_BANDS.map((z, i) => (
        <g key={z.labels[0]}>
          <rect x={0} y={z.y} width={SVG_W} height={z.h} fill={z.fill} />

          {/* Zone band separator */}
          {i > 0 && (
            <line
              x1={0} y1={z.y}
              x2={SVG_W} y2={z.y}
              stroke="rgba(255,255,255,0.05)"
              strokeWidth="0.5"
            />
          )}

          {/* Left zone label */}
          <text
            x={8}
            y={z.y + z.h / 2 + 4}
            fill="rgba(140,190,170,0.5)"
            fontSize="9"
            fontFamily="monospace"
          >
            {z.labels[0]}
          </text>

          {/* Right zone label */}
          <text
            x={SVG_W - 8}
            y={z.y + z.h / 2 + 4}
            fill="rgba(140,190,170,0.5)"
            fontSize="9"
            textAnchor="end"
            fontFamily="monospace"
          >
            {z.labels[1]}
          </text>
        </g>
      ))}
    </>
  )
}

function RailTrack() {
  const railY1 = TRACK_Y + 16
  const railY2 = TRACK_Y + TRACK_H - 16
  const ties   = []

  for (let y = TRACK_Y + 8; y < TRACK_Y + TRACK_H - 6; y += 9) {
    ties.push(
      <rect key={y} x={8} y={y} width={SVG_W - 16} height={4} rx={1} fill="#2e2828" />
    )
  }

  return (
    <>
      <rect x={0} y={TRACK_Y} width={SVG_W} height={TRACK_H} fill="#0c0c0c" />
      {ties}
      <line x1={0} y1={railY1} x2={SVG_W} y2={railY1} stroke="#5a5555" strokeWidth="2.5" />
      <line x1={0} y1={railY2} x2={SVG_W} y2={railY2} stroke="#5a5555" strokeWidth="2.5" />
    </>
  )
}

function GateBarrier({ y }) {
  return (
    <>
      {/* Left pivot bracket */}
      <rect
        x={ROAD_L - PIVOT_W}
        y={y - PIVOT_H / 2}
        width={PIVOT_W}
        height={PIVOT_H}
        rx={1}
        fill="#686e76"
      />
      {/* Right pivot bracket */}
      <rect
        x={ROAD_R}
        y={y - PIVOT_H / 2}
        width={PIVOT_W}
        height={PIVOT_H}
        rx={1}
        fill="#686e76"
      />
      {/* Barrier arm */}
      <line
        x1={ROAD_L} y1={y}
        x2={ROAD_R} y2={y}
        stroke="#FFD700"
        strokeWidth="3.5"
        strokeLinecap="round"
      />
    </>
  )
}

function RoadCentreLine() {
  // Dashed centre line between barriers, skipping the track bed
  const segments = []
  for (let y = BARRIER_T + 8; y < BARRIER_B - 8; y += 12) {
    const segEnd = Math.min(y + 6, BARRIER_B - 8)
    if (y >= TRACK_Y - 2 && y <= TRACK_Y + TRACK_H + 2) continue
    segments.push(
      <line
        key={y}
        x1={ROAD_CX} y1={y}
        x2={ROAD_CX} y2={segEnd}
        stroke="rgba(255,215,0,0.35)"
        strokeWidth="1"
      />
    )
  }
  return <>{segments}</>
}

export default function TrackZoneMap() {
  return (
    <div className="panel track-zone-map">
      <div className="panel__header">
        <span className="panel__title">Track Zone Map</span>
        <div className="panel__meta">
          <span className="panel__tag">LC-01</span>
          <span className="panel__status panel__status--ok">NOMINAL</span>
        </div>
      </div>
      <div className="panel__body track-zone-map__body">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="track-zone-map__svg"
        >
          <ZoneBands />
          <RailTrack />

          {/* Road centre tracking line */}
          <RoadCentreLine />

          {/* Gate barriers */}
          <GateBarrier y={BARRIER_T} />
          <GateBarrier y={BARRIER_B} />

          {/* Track direction indicators */}
          <text
            x={ROAD_CX} y={18}
            fill="rgba(140,190,170,0.4)"
            fontSize="10"
            textAnchor="middle"
            fontFamily="monospace"
          >
            ▼
          </text>
          <text
            x={ROAD_CX} y={SVG_H - 6}
            fill="rgba(140,190,170,0.4)"
            fontSize="10"
            textAnchor="middle"
            fontFamily="monospace"
          >
            ▲
          </text>
        </svg>
      </div>
    </div>
  )
}
