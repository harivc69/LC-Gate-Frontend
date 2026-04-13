import '../styles/TrackZoneMap.css'

// ── SVG dimensions ────────────────────────────────────────────────────────────
const SVG_W   = 160
const SVG_H   = 408
const ROAD_CX = SVG_W / 2   // 80

// ── Zone layout ───────────────────────────────────────────────────────────────
//   y=0          TZ-1/TZ-2   h=ZH
//   y=ZH         IZ-1/IZ-2   h=ZH
//   y=ZH*2       CZ-1/CZ-2   h=ZH
//   y=ZH*3       TRACK        h=TH
//   y=ZH*3+TH    CZ-3/CZ-4   h=ZH
//   y=ZH*4+TH    IZ-3/IZ-4   h=ZH
//   y=ZH*5+TH    TZ-3/TZ-4   h=ZH
const ZH = 58
const TH = 60   // track height

const ZONE_BANDS = [
  { labels: ['TZ-1', 'TZ-2'], y: 0,          h: ZH, fill: '#071c1c' },
  { labels: ['IZ-1', 'IZ-2'], y: ZH,         h: ZH, fill: '#0f2828' },
  { labels: ['CZ-1', 'CZ-2'], y: ZH * 2,     h: ZH, fill: '#0d2714' },
  { labels: ['CZ-3', 'CZ-4'], y: ZH * 3 + TH, h: ZH, fill: '#0d2714' },
  { labels: ['IZ-3', 'IZ-4'], y: ZH * 4 + TH, h: ZH, fill: '#0f2828' },
  { labels: ['TZ-3', 'TZ-4'], y: ZH * 5 + TH, h: ZH, fill: '#071c1c' },
]

// ── Track ─────────────────────────────────────────────────────────────────────
const TRACK_Y = ZH * 3
const TRACK_H = TH
const RAIL_Y1 = TRACK_Y + 13
const RAIL_Y2 = TRACK_Y + TRACK_H - 13

// ── Barrier positions — at zone boundaries ────────────────────────────────────
const BY_OUTER_T = ZH           // 58  — TZ/IZ boundary (top)
const BY_INNER_T = ZH * 2      // 116 — IZ/CZ boundary (top)
const BY_INNER_B = ZH * 4 + TH // 292 — CZ/IZ boundary (bottom)
const BY_OUTER_B = ZH * 5 + TH // 350 — IZ/TZ boundary (bottom)

const PIV_L  = 4
const PIV_R  = SVG_W - 4
const POST_W = 6
const POST_H = 6

// ── Sub-components ────────────────────────────────────────────────────────────

// Convert zone label like 'TZ-1' → fusion zone key 'TZ1'
function labelToKey(label) {
  return label.replace('-', '')
}

function ZoneBands({ fusionZones = {} }) {
  return (
    <>
      {ZONE_BANDS.map((z, i) => {
        const keyL = labelToKey(z.labels[0])
        const keyR = labelToKey(z.labels[1])
        const countL = fusionZones[keyL] ?? 0
        const countR = fusionZones[keyR] ?? 0
        const cy = z.y + z.h / 2

        return (
          <g key={z.labels[0]}>
            <rect x={0} y={z.y} width={SVG_W} height={z.h} fill={z.fill} />
            {i > 0 && (
              <line x1={0} y1={z.y} x2={SVG_W} y2={z.y}
                stroke="rgba(255,255,255,0.05)" strokeWidth="0.5" />
            )}
            <text x={-5} y={cy + 3}
              fill="rgba(140,190,170,0.5)" fontSize="7.5" textAnchor="end" fontFamily="monospace">
              {z.labels[0]}
            </text>
            <text x={SVG_W + 5} y={cy + 3}
              fill="rgba(140,190,170,0.5)" fontSize="7.5" textAnchor="start" fontFamily="monospace">
              {z.labels[1]}
            </text>

            {/* Fusion count — left half center */}
            <text x={ROAD_CX / 2} y={cy + 1}
              fill={countL > 0 ? '#00ff99' : 'rgba(0,255,153,0.35)'}
              fontSize={countL > 0 ? 16 : 13}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="monospace">
              {countL}
            </text>

            {/* Fusion count — right half center */}
            <text x={ROAD_CX + ROAD_CX / 2} y={cy + 1}
              fill={countR > 0 ? '#00ff99' : 'rgba(0,255,153,0.35)'}
              fontSize={countR > 0 ? 16 : 13}
              fontWeight="bold"
              textAnchor="middle"
              dominantBaseline="middle"
              fontFamily="monospace">
              {countR}
            </text>
          </g>
        )
      })}
    </>
  )
}

function RailTrack() {
  const sleeperY = RAIL_Y1 - 4
  const sleeperH = RAIL_Y2 - RAIL_Y1 + 8
  const sleepers = []
  for (let tx = 6; tx < SVG_W - 6; tx += 9) {
    sleepers.push(
      <rect key={tx} x={tx} y={sleeperY} width={4} height={sleeperH} rx={0.5} fill="#3a4858" />
    )
  }
  return (
    <>
      <rect x={0} y={TRACK_Y} width={SVG_W} height={TRACK_H} fill="#131c1a" />
      {sleepers}
      <line x1={0} y1={RAIL_Y1} x2={SVG_W} y2={RAIL_Y1} stroke="#4a6888" strokeWidth="4.5" />
      <line x1={0} y1={RAIL_Y2} x2={SVG_W} y2={RAIL_Y2} stroke="#4a6888" strokeWidth="4.5" />
      <line x1={0} y1={RAIL_Y1 - 1} x2={SVG_W} y2={RAIL_Y1 - 1} stroke="#88aed0" strokeWidth="1.2" />
      <line x1={0} y1={RAIL_Y2 - 1} x2={SVG_W} y2={RAIL_Y2 - 1} stroke="#88aed0" strokeWidth="1.2" />
    </>
  )
}

// ── Barrier state helpers ─────────────────────────────────────────────────────

function getBarrierState(barriers, name) {
  // Direct key lookup
  if (barriers[name]) return barriers[name]
  // Map IB* → first inner_* key, OB* → first outer_* key
  if (name.startsWith('IB')) {
    const key = Object.keys(barriers).find(k => k.startsWith('inner'))
    if (key) return barriers[key]
  }
  if (name.startsWith('OB')) {
    const key = Object.keys(barriers).find(k => k.startsWith('outer'))
    if (key) return barriers[key]
  }
  return null
}

// default 0,0,0 = OPEN
function deriveState(state) {
  if (!state) return { armDown: false, label: 'OPEN', pivotFill: '#F5C200', labelFill: '#00c853' }
  if (state.close)  return { armDown: true, label: 'CLOSED', pivotFill: '#F5C200', labelFill: '#ffc107' }
  return { armDown: false, label: 'OPEN', pivotFill: '#F5C200', labelFill: '#00c853' }
}

/**
 * Barrier types:
 *   'left-half'  — pivot LEFT  edge → centre
 *   'right-half' — pivot RIGHT edge → centre
 *   'full-left'  — pivot LEFT  edge → RIGHT edge  (top inner barrier)
 *   'full-right' — pivot RIGHT edge → LEFT  edge  (bottom inner barrier)
 */
function Barrier({ y, type, state, name }) {
  const { armDown, label, pivotFill, labelFill } = deriveState(state)
  const fromRight = type === 'right-half' || type === 'full-right'
  const pivotX    = fromRight ? PIV_R : PIV_L
  const armEnd    = fromRight
    ? (type === 'full-right' ? 0      : ROAD_CX)
    : (type === 'full-left'  ? SVG_W  : ROAD_CX)
  const armLen    = Math.abs(armEnd - pivotX)
  const tipNear   = fromRight ? armEnd + 10 : armEnd - 10
  const textX     = fromRight ? pivotX + 8 : pivotX - 8
  const anchor    = fromRight ? 'start' : 'end'

  // Top-view extend/retract: scaleX from the pivot point
  const scaleX = armDown ? 1 : 0

  return (
    <>
      <rect
        x={pivotX - POST_W / 2} y={y - POST_H / 2}
        width={POST_W} height={POST_H} rx={2} fill="#3a4452"
      />
      <circle cx={pivotX} cy={y} r={3.5} fill={pivotFill} stroke="#606878" strokeWidth="0.8"
        className="tzm-barrier-pivot" />
      {name && (
        <>
          <text x={textX} y={y - 4}
            fill="rgba(140,190,170,0.5)" fontSize="7" fontWeight="bold"
            fontFamily="monospace" textAnchor={anchor} dominantBaseline="middle"
          >{name}</text>
          <text x={textX} y={y + 6}
            fill={labelFill} fontSize="6" fontWeight="bold"
            fontFamily="monospace" textAnchor={anchor} dominantBaseline="middle"
            className="tzm-barrier-label"
          >{label}</text>
        </>
      )}

      {/* Arm: always rendered, animated via scaleX extend/retract from pivot */}
      <g
        className="tzm-barrier-arm"
        style={{
          transform: `translate(${pivotX}px, 0) scaleX(${scaleX}) translate(${-pivotX}px, 0)`,
        }}
      >
        <line x1={pivotX} y1={y} x2={armEnd} y2={y}
          stroke="#F5C200" strokeWidth="2" strokeLinecap="butt" />
        {Array.from({ length: Math.floor(armLen / 10) }, (_, i) => {
          if (i % 2 === 0) return null
          const bx = fromRight ? pivotX - (i + 1) * 10 : pivotX + i * 10
          return (
            <rect key={i} x={bx} y={y - 1.5} width={10} height={3}
              fill="#111111" opacity="0.58" />
          )
        })}
        <line x1={tipNear} y1={y} x2={armEnd} y2={y}
          stroke="#cc1800" strokeWidth="2" strokeLinecap="butt" />
      </g>
    </>
  )
}

function RoadCentreLine() {
  const skipZones = [
    [TRACK_Y - 2, TRACK_Y + TRACK_H + 2],
    ...[BY_OUTER_T, BY_INNER_T, BY_INNER_B, BY_OUTER_B].map(by => [by - 4, by + 4]),
  ]
  const segs = []
  for (let y = 8; y < SVG_H - 8; y += 14) {
    const end  = Math.min(y + 7, SVG_H - 8)
    const skip = skipZones.some(([a, b]) => y <= b && end >= a)
    if (!skip) {
      segs.push(
        <line key={y} x1={ROAD_CX} y1={y} x2={ROAD_CX} y2={end}
          stroke="rgba(255,215,0,0.20)" strokeWidth="1.2" />
      )
    }
  }
  return <>{segs}</>
}

// ── Main component ────────────────────────────────────────────────────────────
export default function TrackZoneMap({ fusionZones = {}, barriers = {} }) {
  const bs = (name) => getBarrierState(barriers, name)

  return (
    <div className="panel track-zone-map">
      <div className="panel__header">
        <span className="panel__title">LC Gate Zone Map</span>
      </div>

      <div className="panel__body track-zone-map__body">
        <svg
          viewBox={`-30 0 ${SVG_W + 60} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="track-zone-map__svg"
        >
          <ZoneBands fusionZones={fusionZones} />
          <RailTrack />
          <RoadCentreLine />

          {/* Outer top — left + right half barriers */}
          <Barrier y={BY_OUTER_T} type="left-half"  state={bs('OB1')} name="OB1" />
          <Barrier y={BY_OUTER_T} type="right-half" state={bs('OB2')} name="OB2" />

          {/* Inner top — full barrier, pivot RIGHT, arm goes LEFT */}
          <Barrier y={BY_INNER_T} type="full-right" state={bs('IB1')} name="IB1" />

          {/* Inner bottom — full barrier, pivot LEFT, arm goes RIGHT */}
          <Barrier y={BY_INNER_B} type="full-left"  state={bs('IB2')} name="IB2" />

          {/* Outer bottom — left + right half barriers */}
          <Barrier y={BY_OUTER_B} type="left-half"  state={bs('OB3')} name="OB3" />
          <Barrier y={BY_OUTER_B} type="right-half" state={bs('OB4')} name="OB4" />

          <text x={ROAD_CX + 40} y={12} fill="rgba(140,190,170,0.38)" fontSize="11"
            textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">▼</text>
          <text x={ROAD_CX - 40} y={SVG_H - 12} fill="rgba(140,190,170,0.38)" fontSize="11"
            textAnchor="middle" dominantBaseline="middle" fontFamily="monospace">▲</text>
        </svg>
      </div>
    </div>
  )
}
