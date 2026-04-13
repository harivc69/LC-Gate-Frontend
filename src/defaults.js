// ── Centralized default state & shared constants ────────────────────────────
// Single source of truth for initial values used across Dashboard,
// GateOverview, TrackZoneMap, and services.

// ── Subsystem definitions ───────────────────────────────────────────────────
export const SUBSYSTEMS = [
  { id: 'camera',   label: 'CAMERA' },
  { id: 'radar',    label: 'RADAR' },
  { id: 'dcdc',     label: 'DCDC' },
  { id: 'mcu',      label: 'MCU' },
  { id: 'img_mpu',  label: 'IMG.MPU' },
  { id: 'barrier',  label: 'BARRIER INTEGRITY' },
  { id: 'sensor',   label: 'SENSORS' },
]

export const SUBSYSTEM_LABELS = Object.fromEntries(
  SUBSYSTEMS.map(s => [s.id, s.label])
)

// ── Gate positions (6 gates shown in overview grid & zone map) ──────────────
export const GATES = [
  { name: 'OB1' },
  { name: 'OB2' },
  { name: 'IB1' },
  { name: 'OB3' },
  { name: 'OB4' },
  { name: 'IB2' },
]

export const ALL_GATE_NAMES = ['OB1', 'OB2', 'OB3', 'OB4', 'IB1', 'IB2']

// ── Fusion zone keys ────────────────────────────────────────────────────────
export const ZONE_KEYS = [
  'TZ1', 'TZ2', 'TZ3', 'TZ4',
  'IZ1', 'IZ2', 'IZ3', 'IZ4',
  'CZ1', 'CZ2', 'CZ3', 'CZ4',
]

// ── Default dashboard state ─────────────────────────────────────────────────
export const DEFAULT_GATE = {
  manualOverride: false,
  manualOverrideReq: false,
  autoModeAck: null,
  trainArriving: false,
  trainDeparting: false,
}

export const DEFAULT_STATUSES = {
  camera: 'healthy',
  radar: 'healthy',
  dcdc: 'healthy',
  mcu: 'healthy',
  img_mpu: 'healthy',
  sensor: 'healthy',
  barrier: 'healthy',
}

// ── Command structure sent to MCU via cmd-bridge ────────────────────────────
export const DEFAULT_COMMAND = {
  manual_override_ack: 0,
  err_clear: 0,
  auto_mode_req: 0,
}

// ── Gate close/open sequence timing ──────────────────────────────────────────
// First gate 8 s after signal; each subsequent gate 8 s apart.
// IB1 & IB2 always move together.
export const CLOSE_STEPS = [
  { gates: ['OB2'],          delay: 5000 },   // 1
  { gates: ['OB3'],          delay: 13000 },  // 2
  { gates: ['OB4'],          delay: 21000 },  // 3
  { gates: ['OB1'],          delay: 29000 },  // 4
  { gates: ['IB1', 'IB2'],  delay: 37000 },  // 5 — together
]

export const OPEN_STEPS = [
  { gates: ['OB2', 'OB3', 'IB1', 'IB2'], delay: 2000 }, // 1 — together after 2 s
  { gates: ['OB1', 'OB4'],               delay: 6000 }, // 2 — together after 6 s
]

// Legacy single duration — kept for backward compatibility
export const SEQUENCE_DURATION = 45000

// Per-direction durations: how long the frontend animation is considered
// "active" (and blocks MCU state from overriding it).
export const CLOSE_DURATION = 45000
export const OPEN_DURATION  = 8000

// ── Feed probe timing ───────────────────────────────────────────────────────
export const PROBE_INTERVAL = 5000
export const PROBE_TIMEOUT = 4000

// ── Alarm tone settings ─────────────────────────────────────────────────────
export const ALARM = {
  highFreq: 800,
  lowFreq: 600,
  highGain: 0.15,
  lowGain: 0.08,
  toggleMs: 500,
}
