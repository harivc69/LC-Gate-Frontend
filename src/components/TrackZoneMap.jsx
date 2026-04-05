import '../styles/TrackZoneMap.css'

// ── SVG dimensions ────────────────────────────────────────────────────────────
const SVG_W  = 280
const SVG_H  = 408
const ROAD_W = 90
const ROAD_L = (SVG_W - ROAD_W) / 2   // 95
const ROAD_R = ROAD_L + ROAD_W        // 185
const ROAD_CX = SVG_W / 2            // 140

// ── Zone bands ────────────────────────────────────────────────────────────────
const ZONE_BANDS = [
  { labels: ['TZ-1', 'TZ-2'], y: 0,   h: 65,  fill: '#071c1c' },
  { labels: ['IZ-1', 'IZ-2'], y: 65,  h: 58,  fill: '#0f2828' },
  { labels: ['CZ-1', 'CZ-2'], y: 123, h: 50,  fill: '#0d2714' },
  { labels: ['CZ-3', 'CZ-4'], y: 235, h: 50,  fill: '#0d2714' },
  { labels: ['IZ-3', 'IZ-4'], y: 285, h: 58,  fill: '#0f2828' },
  { labels: ['TZ-3', 'TZ-4'], y: 343, h: 65,  fill: '#071c1c' },
]

// ── Track ─────────────────────────────────────────────────────────────────────
const TRACK_Y  = 173
const TRACK_H  = 62
const RAIL_Y1  = TRACK_Y + 13         // 186 — upper rail
const RAIL_Y2  = TRACK_Y + TRACK_H - 13 // 222 — lower rail

// ── Barrier Y positions — placed exactly at zone boundary lines ───────────────
//
//   y=0   ┌─ TZ-1 / TZ-2 ─────────────────────────────────────── h=65
//  y=65   ├─ OUTER barrier (half L + half R) ◄── TZ / IZ boundary
//         ├─ IZ-1 / IZ-2 ─────────────────────────────────────── h=58
//  y=123  ├─ INNER barrier (full) ◄──────────────────────────── IZ / CZ boundary
//         ├─ CZ-1 / CZ-2 ─────────────────────────────────────── h=50
//  y=173  ├─ TRACK ──────────────────────────────────────────────── h=62
//  y=235  ├─ CZ-3 / CZ-4 ─────────────────────────────────────── h=50
//  y=285  ├─ INNER barrier (full) ◄──────────────────────────── CZ / IZ boundary
//         ├─ IZ-3 / IZ-4 ─────────────────────────────────────── h=58
//  y=343  ├─ OUTER barrier (half L + half R) ◄── IZ / TZ boundary
//         └─ TZ-3 / TZ-4 ─────────────────────────────────────── h=65
//
const BY_OUTER_T = 65    // TZ / IZ boundary — 2 half barriers (L + R)
const BY_INNER_T = 123   // IZ / CZ boundary — 1 full barrier
const BY_INNER_B = 285   // CZ / IZ boundary — 1 full barrier
const BY_OUTER_B = 343   // IZ / TZ boundary — 2 half barriers (L + R)

// Pivot x insets (stay inside SVG viewport)
const PIV_L = 4           // left-edge pivot
const PIV_R = SVG_W - 4  // right-edge pivot  (276)

const POST_W = 8
const POST_H = 10

// ── Sub-components ────────────────────────────────────────────────────────────

function ZoneBands() {
  return (
    <>
      {ZONE_BANDS.map((z, i) => (
        <g key={z.labels[0]}>
          <rect x={0} y={z.y} width={SVG_W} height={z.h} fill={z.fill} />
          {i > 0 && (
            <line x1={0} y1={z.y} x2={SVG_W} y2={z.y}
              stroke="rgba(255,255,255,0.05)" strokeWidth="0.5"
            />
          )}
          <text x={7} y={z.y + z.h / 2 + 4}
            fill="rgba(140,190,170,0.5)" fontSize="8.5" fontFamily="monospace">
            {z.labels[0]}
          </text>
          <text x={SVG_W - 7} y={z.y + z.h / 2 + 4}
            fill="rgba(140,190,170,0.5)" fontSize="8.5" textAnchor="end" fontFamily="monospace">
            {z.labels[1]}
          </text>
        </g>
      ))}
    </>
  )
}

// Road corridor overlay + edge kerb lines
function RoadSurface() {
  return (
    <>
      <rect x={ROAD_L} y={0} width={ROAD_W} height={SVG_H}
        fill="rgba(255,255,255,0.03)"
      />
      <line x1={ROAD_L} y1={0} x2={ROAD_L} y2={SVG_H}
        stroke="rgba(220,220,220,0.14)" strokeWidth="0.75"
      />
      <line x1={ROAD_R} y1={0} x2={ROAD_R} y2={SVG_H}
        stroke="rgba(220,220,220,0.14)" strokeWidth="0.75"
      />
    </>
  )
}

/**
 * Top-down view of a railway track:
 *  - Two horizontal RAILS (running left–right along the track direction)
 *  - Many thin vertical SLEEPERS / TIES (running perpendicular to rails,
 *    i.e. top–bottom in this map view)
 */
function RailTrack() {
  const sleeperY = RAIL_Y1 - 4              // sleeper starts 4 px above upper rail
  const sleeperH = RAIL_Y2 - RAIL_Y1 + 8   // sleeper height spans 4 px past each rail

  const sleepers = []
  for (let tx = 6; tx < SVG_W - 6; tx += 9) {
    sleepers.push(
      <rect key={tx} x={tx} y={sleeperY} width={4} height={sleeperH} rx={0.5} fill="#3a4858" />
    )
  }

  return (
    <>
      {/* Track ballast bed */}
      <rect x={0} y={TRACK_Y} width={SVG_W} height={TRACK_H} fill="#09100e" />

      {/* Road-crossing surface (slight contrast) */}
      <rect x={ROAD_L} y={TRACK_Y} width={ROAD_W} height={TRACK_H} fill="#131c1a" />

      {/* Sleepers — vertical, perpendicular to track */}
      {sleepers}

      {/* Rail bodies */}
      <line x1={0} y1={RAIL_Y1} x2={SVG_W} y2={RAIL_Y1} stroke="#4a6888" strokeWidth="4.5" />
      <line x1={0} y1={RAIL_Y2} x2={SVG_W} y2={RAIL_Y2} stroke="#4a6888" strokeWidth="4.5" />

      {/* Rail head highlights — top bright edge gives I-beam illusion */}
      <line x1={0} y1={RAIL_Y1 - 1} x2={SVG_W} y2={RAIL_Y1 - 1} stroke="#88aed0" strokeWidth="1.2" />
      <line x1={0} y1={RAIL_Y2 - 1} x2={SVG_W} y2={RAIL_Y2 - 1} stroke="#88aed0" strokeWidth="1.2" />
    </>
  )
}

/**
 * Single barrier gate arm.
 *
 * type
 *   'full'       — pivot at LEFT edge (PIV_L), arm reaches RIGHT edge (PIV_R)
 *   'left-half'  — pivot at LEFT edge (PIV_L), arm reaches SVG centre (ROAD_CX)
 *   'right-half' — pivot at RIGHT edge (PIV_R), arm reaches SVG centre (ROAD_CX)
 *
 * open
 *   false (default) = arm horizontal / lowered  (road blocked)
 *   true            = arm raised ~80°            (traffic can pass)
 *
 * Animation: CSS .tzm-barrier-arm class applies a transition so that toggling
 * the 'open' prop animates the lift / lower smoothly.
 */
function Barrier({ y, type, open = false }) {
  const isRight  = type === 'right-half'
  const isFull   = type === 'full'
  const pivotX   = isRight ? PIV_R : PIV_L
  const armEnd   = isRight ? ROAD_CX : (isFull ? PIV_R : ROAD_CX)
  const armLen   = Math.abs(armEnd - pivotX)
  const openAng  = isRight ? 80 : -80

  // Red tip: last 10 px at the free end of the arm
  const tipNear  = isRight ? armEnd + 10 : armEnd - 10

  return (
    <>
      {/* Pivot post — fixed, does not rotate */}
      <rect
        x={pivotX - POST_W / 2}
        y={y - POST_H / 2}
        width={POST_W}
        height={POST_H}
        rx={2}
        fill="#3a4452"
      />
      <circle cx={pivotX} cy={y} r={4} fill="#4c5668" stroke="#606878" strokeWidth="0.8" />

      {/* ── Rotating group ── */}
      <g
        className="tzm-barrier-arm"
        transform={`rotate(${open ? openAng : 0}, ${pivotX}, ${y})`}
      >
        {/* Yellow arm body */}
        <line
          x1={pivotX} y1={y} x2={armEnd} y2={y}
          stroke="#F5C200" strokeWidth="5" strokeLinecap="butt"
        />

        {/* Alternating black warning stripes */}
        {Array.from({ length: Math.floor(armLen / 10) }, (_, i) => {
          if (i % 2 === 0) return null   // yellow gaps are skipped
          const bx = isRight ? pivotX - (i + 1) * 10 : pivotX + i * 10
          return (
            <rect
              key={i}
              x={bx} y={y - 2.5}
              width={10} height={5}
              fill="#111111"
              opacity="0.58"
            />
          )
        })}

        {/* Red reflector tip */}
        <line
          x1={tipNear} y1={y} x2={armEnd} y2={y}
          stroke="#cc1800" strokeWidth="5" strokeLinecap="butt"
        />
      </g>
    </>
  )
}

// Dashed centre-line along the road, gap at track band and at each barrier y
function RoadCentreLine() {
  const barrierYs = [BY_OUTER_T, BY_INNER_T, BY_INNER_B, BY_OUTER_B]
  const skipZones = [
    [TRACK_Y - 2, TRACK_Y + TRACK_H + 2],
    ...barrierYs.map(by => [by - 4, by + 4]),
  ]

  const segs = []
  for (let y = 8; y < SVG_H - 8; y += 14) {
    const end  = Math.min(y + 7, SVG_H - 8)
    const skip = skipZones.some(([a, b]) => y <= b && end >= a)
    if (!skip) {
      segs.push(
        <line key={y} x1={ROAD_CX} y1={y} x2={ROAD_CX} y2={end}
          stroke="rgba(255,215,0,0.20)" strokeWidth="1.2"
        />
      )
    }
  }
  return <>{segs}</>
}

// ── Main component ────────────────────────────────────────────────────────────

/**
 * trainArriving / trainDeparting control the panel header badge.
 *
 * To animate barriers later, add a barriersOpen prop:
 *   barriersOpen = { outerT, innerT, innerB, outerB }  (all boolean)
 * and pass open={barriersOpen.innerT} etc. to each <Barrier>.
 */
export default function TrackZoneMap({
  trainArriving  = false,
  trainDeparting = false,
}) {
  let statusLabel = 'NOMINAL'
  let statusCls   = 'panel__status--ok'
  if (trainArriving)       { statusLabel = 'ARRIVAL';   statusCls = 'panel__status--fault' }
  else if (trainDeparting) { statusLabel = 'DEPARTURE'; statusCls = 'panel__status--warn'  }

  return (
    <div className="panel track-zone-map">
      <div className="panel__header">
        <span className="panel__title">Track Zone Map</span>
        <div className="panel__meta">
          <span className="panel__tag">LC-01</span>
          <span className={`panel__status ${statusCls}`}>{statusLabel}</span>
        </div>
      </div>

      <div className="panel__body track-zone-map__body">
        <svg
          viewBox={`0 0 ${SVG_W} ${SVG_H}`}
          preserveAspectRatio="xMidYMid meet"
          className="track-zone-map__svg"
        >
          {/* 1 — zone backgrounds */}
          <ZoneBands />

          {/* 2 — road corridor + kerb lines */}
          <RoadSurface />

          {/* 3 — railway track */}
          <RailTrack />

          {/* 4 — road centre-line dashes */}
          <RoadCentreLine />

          {/* ── 6 barriers ───────────────────────────────────────────── */}

          {/* Outer top — 2 half barriers (left + right, meet at centre) */}
          <Barrier y={BY_OUTER_T} type="left-half" />
          <Barrier y={BY_OUTER_T} type="right-half" />

          {/* Inner top — 1 full barrier (spans full map width) */}
          <Barrier y={BY_INNER_T} type="full" />

          {/* Inner bottom — 1 full barrier */}
          <Barrier y={BY_INNER_B} type="full" />

          {/* Outer bottom — 2 half barriers */}
          <Barrier y={BY_OUTER_B} type="left-half" />
          <Barrier y={BY_OUTER_B} type="right-half" />

          {/* ── Road traffic direction arrows ─────────────────────── */}
          <text x={ROAD_CX} y={16}
            fill="rgba(140,190,170,0.38)" fontSize="11"
            textAnchor="middle" fontFamily="monospace">▼</text>
          <text x={ROAD_CX} y={SVG_H - 5}
            fill="rgba(140,190,170,0.38)" fontSize="11"
            textAnchor="middle" fontFamily="monospace">▲</text>
        </svg>
      </div>
    </div>
  )
}
