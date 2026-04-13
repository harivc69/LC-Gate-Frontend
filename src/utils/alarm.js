// Module-level alarm controller.
// AudioContext is created and unlocked on the first user interaction with
// the app, so that by the time a manual-override request arrives the alarm
// can start playing immediately without any modal-local unlock step.

import { ALARM } from '../defaults'

let ctx = null
let osc = null
let gain = null
let toneTimer = null
let primed = false

function ensureCtx() {
  if (ctx) return ctx
  try {
    ctx = new (window.AudioContext || window.webkitAudioContext)()
  } catch {
    ctx = null
  }
  return ctx
}

/** Install global listeners that unlock the audio context on the first
 *  user interaction. Safe to call multiple times. */
export function primeAlarm() {
  if (primed) return
  primed = true

  const unlock = () => {
    const c = ensureCtx()
    if (c && c.state === 'suspended') c.resume().catch(() => {})
  }
  // Try once now in case we're already in an allowed context
  unlock()
  document.addEventListener('click', unlock, true)
  document.addEventListener('touchstart', unlock, true)
  document.addEventListener('keydown', unlock, true)
  document.addEventListener('pointerdown', unlock, true)
}

/** Start the alarm immediately. No-op if already playing. */
export function startAlarm() {
  const c = ensureCtx()
  if (!c) return
  if (c.state === 'suspended') c.resume().catch(() => {})
  if (osc) return

  osc = c.createOscillator()
  gain = c.createGain()
  osc.type = 'sine'
  osc.frequency.value = ALARM.highFreq
  gain.gain.value = ALARM.highGain
  osc.connect(gain)
  gain.connect(c.destination)
  osc.start()

  let high = true
  toneTimer = setInterval(() => {
    high = !high
    osc.frequency.value = high ? ALARM.highFreq : ALARM.lowFreq
    gain.gain.value = high ? ALARM.highGain : ALARM.lowGain
  }, ALARM.toggleMs)
}

/** Stop the alarm. Safe to call if not playing. */
export function stopAlarm() {
  if (toneTimer) {
    clearInterval(toneTimer)
    toneTimer = null
  }
  if (osc) {
    try { osc.stop() } catch {}
    try { osc.disconnect() } catch {}
    osc = null
  }
  if (gain) {
    try { gain.disconnect() } catch {}
    gain = null
  }
}
