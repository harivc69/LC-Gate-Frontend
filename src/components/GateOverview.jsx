import '../styles/GateOverview.css'
import { SUBSYSTEMS, GATES } from '../defaults'

function getBarrierState(barriers, name) {
  // Direct match (e.g. OB2)
  if (barriers[name]) return barriers[name]
  // Prefix fallback (e.g. outer → outer_barrier_1)
  const prefix = name.startsWith('OB') ? 'outer' : name.startsWith('IB') ? 'inner' : null
  if (prefix) {
    const key = Object.keys(barriers).find(k => k.toLowerCase().startsWith(prefix))
    if (key) return barriers[key]
  }
  return null
}

// ── Overall gate state logic ─────────────────────────────────────────────────
// Derives direction from OB2 actual state (first gate to close / first to open)
function overallState(barriers, integrity, sequenceDirection) {
  const gateStates = GATES.map(g => getBarrierState(barriers, g.name))

  // Default: no barrier data = all open
  if (gateStates.every(s => !s)) {
    return { label: 'ALL GATES OPEN', cls: 'go--open' }
  }

  if (integrity && integrity !== 'BARRIER_OK' && integrity !== 'OK') {
    return { label: 'FAULT', cls: 'go--fault' }
  }

  const gates = Object.entries(barriers)
  if (gates.length === 0) return { label: 'ALL GATES OPEN', cls: 'go--open' }

  const allLocked = gates.every(([, v]) => v.locked)
  const allClosed = gates.every(([, v]) => v.close)
  const allOpen   = gates.every(([, v]) => !v.close && !v.locked)

  if (allLocked) return { label: 'LC GATE LOCKED',   cls: 'go--locked' }
  if (allClosed) return { label: 'ALL GATES CLOSED', cls: 'go--closed' }
  if (allOpen)   return { label: 'ALL GATES OPEN',   cls: 'go--open' }

  // Mixed — during an active sequence, force the label to match direction
  if (sequenceDirection === 'opening') {
    return { label: 'PARTIALLY OPENED', cls: 'go--partial' }
  }
  if (sequenceDirection === 'closing') {
    return { label: 'PARTIALLY CLOSED', cls: 'go--partial' }
  }

  // No active sequence — fall back to OB2 state
  const ob2 = getBarrierState(barriers, 'OB2')
  if (ob2 && ob2.close) {
    return { label: 'PARTIALLY CLOSED', cls: 'go--partial' }
  }
  return { label: 'PARTIALLY OPENED', cls: 'go--partial' }
}

// ── Per-gate state (default 0,0,0 = OPEN) ────────────────────────────────────
function gateState(state) {
  if (!state) return { text: 'OPEN', cls: 'go__cell--open' }
  if (state.locked) return { text: 'CLOSED', cls: 'go__cell--closed' }
  if (state.close)  return { text: 'CLOSED', cls: 'go__cell--closed' }
  return { text: 'OPEN', cls: 'go__cell--open' }
}

// ── Parse barrier integrity error codes ──────────────────────────────────────
// e.g. "ERR_OB2" → "OB2 Barrier Integrity Compromised!"
function parseIntegrityError(val) {
  if (!val || val === 'healthy' || val === 'faulty') return null
  const match = val.match(/^ERR[_\s]*(.+)/i)
  if (match) return `${match[1].toUpperCase()} Barrier Integrity Compromised!`
  return `Barrier Integrity Compromised!`
}

// ── Health status: 'healthy' | 'faulty' | 'unavailable' | error string | false ──
function healthDisplay(val, id) {
  if (val === 'healthy')     return { text: 'HEALTHY',          dotCls: 'go__item-dot--ok',          valCls: 'go__item-val--healthy',     hasError: false }
  if (val === 'faulty')      return { text: 'FAULTY',           dotCls: 'go__item-dot--fault',       valCls: 'go__item-val--faulty',      hasError: true }
  if (val === 'unavailable') return { text: 'DATA UNAVAILABLE', dotCls: 'go__item-dot--unavailable', valCls: 'go__item-val--unavailable', hasError: false }
  if (!val)                  return { text: 'HEALTHY',          dotCls: 'go__item-dot--ok',          valCls: 'go__item-val--healthy',     hasError: false }
  // Barrier integrity error string (e.g. "ERR_OB2")
  if (id === 'barrier') {
    const msg = parseIntegrityError(val)
    return { text: msg || 'FAULT', dotCls: 'go__item-dot--fault', valCls: 'go__item-val--faulty', hasError: true }
  }
  return { text: 'FAULTY', dotCls: 'go__item-dot--fault', valCls: 'go__item-val--faulty', hasError: true }
}

// ── Component ────────────────────────────────────────────────────────────────
export default function GateOverview({ barriers = {}, barrierIntegrity = null, statuses = {}, onClearError, sequenceDirection = null }) {
  const { label, cls } = overallState(barriers, barrierIntegrity, sequenceDirection)

  return (
    <div className="panel gate-overview">
      <div className="panel__header">
        <span className="panel__title">System Health &amp; State</span>
      </div>

      <div className="panel__body gate-overview__body">
        {/* ── All Gates card with 3×2 grid ─────────────────── */}
        <div className={`go__card ${cls}`}>
          <div className="go__card-header">
            <span className="go__card-value">{label}</span>
          </div>
          <div className="go__grid">
            {GATES.map(g => {
              const state = getBarrierState(barriers, g.name)
              const { text, cls: cellCls } = gateState(state)
              return (
                <div key={g.name} className={`go__cell ${cellCls}`}>
                  <span className="go__cell-name">{g.name}</span>
                  <span className="go__cell-state">{text}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Health list ───────────────────────────────────── */}
        <div className="go__list">
          {SUBSYSTEMS.map(s => {
            const { text, dotCls, valCls, hasError } = healthDisplay(statuses[s.id], s.id)
            return (
              <div key={s.id} className="go__item-wrap">
                <div className="go__item">
                  <div className="go__item-name-with-dot">
                    <span className={`go__item-dot ${dotCls}`} />
                    <span className="go__item-name">{s.label}</span>
                  </div>
                  <span className={`go__item-val ${valCls}`}>{text}</span>
                </div>
                {hasError && onClearError && (
                  <button className="go__clear-btn" onClick={onClearError}>CLEAR</button>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
