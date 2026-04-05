import '../styles/GateStatusBar.css'

function Lamp({ state, blink = false }) {
  return (
    <span className={`gsb__lamp gsb__lamp--${state}${blink ? ' gsb__lamp--blink' : ''}`} />
  )
}

function Cell({ label, value, state, blink = false }) {
  return (
    <div className="gsb__cell">
      <span className="gsb__label">{label}</span>
      <div className="gsb__row">
        <Lamp state={state} blink={blink} />
        <span className={`gsb__value gsb__value--${state}`}>{value}</span>
      </div>
    </div>
  )
}

/**
 * Horizontal real-time status strip.
 * Always visible — shows current mode even when nominal (AUTOMATIC / CLEAR).
 * On manual override: bar turns red-tinted and GATE MODE cell blinks.
 */
export default function GateStatusBar({
  trainArriving = false,
  trainDeparting = false,
  trainDirection = null,
  manualOverride = false,
}) {
  const northArriving = trainArriving && trainDirection === 'north'
  const northDeparting = trainDeparting && trainDirection === 'north'
  const southArriving = trainArriving && trainDirection === 'south'
  const southDeparting = trainDeparting && trainDirection === 'south'

  const northState = northArriving ? 'fault' : northDeparting ? 'warn' : 'ok'
  const northValue = northArriving ? 'APPROACHING' : northDeparting ? 'DEPARTING' : 'CLEAR'

  const southState = southArriving ? 'fault' : southDeparting ? 'warn' : 'ok'
  const southValue = southArriving ? 'APPROACHING' : southDeparting ? 'DEPARTING' : 'CLEAR'

  const crossingState = trainArriving ? 'fault' : trainDeparting ? 'warn' : 'ok'
  const crossingValue = trainArriving ? 'TRAIN DETECTED' : trainDeparting ? 'CLEARING' : 'CLEAR'

  return (
    <div className={`gsb${manualOverride ? ' gsb--override' : ''}`}>

      <span className="gsb__id">LC-01</span>

      <div className="gsb__sep" />

      <Cell label="↑ NORTH LINE" state={northState} value={northValue} blink={northArriving} />

      <div className="gsb__sep" />

      <Cell label="↓ SOUTH LINE" state={southState} value={southValue} blink={southArriving} />

      <div className="gsb__sep" />

      <Cell label="CROSSING STATUS" state={crossingState} value={crossingValue} blink={trainArriving} />

      {/* spacer pushes GATE MODE to the far right */}
      <div className="gsb__spacer" />

      <div className="gsb__sep" />

      <Cell
        label="GATE MODE"
        state={manualOverride ? 'fault' : 'ok'}
        value={manualOverride ? 'MANUAL OVERRIDE' : 'AUTOMATIC'}
        blink={manualOverride}
      />

    </div>
  )
}
