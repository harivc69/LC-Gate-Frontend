import { useState, useEffect, useRef } from 'react'
import '../styles/Dashboard.css'
import config from '../config'
import {
  DEFAULT_GATE, DEFAULT_STATUSES, DEFAULT_COMMAND, SUBSYSTEM_LABELS,
  ZONE_KEYS, CLOSE_STEPS, OPEN_STEPS, CLOSE_DURATION, OPEN_DURATION,
} from '../defaults'
import SystemHeader from './SystemHeader'
import GateStatusBar from './GateStatusBar'
import CameraView from './CameraView'
import RadarView from './RadarView'
import TrackZoneMap from './TrackZoneMap'
import GateOverview from './GateOverview'
import ManualOverrideModal from './ManualOverrideModal'
import { FusionStream } from '../services/FusionStream'
import { McuStream } from '../services/McuStream'
import { CommandStream } from '../services/CommandStream'
import { primeAlarm } from '../utils/alarm'

export default function Dashboard() {
  const [gate, setGate] = useState({ ...DEFAULT_GATE })
  const [autoModeMsg, setAutoModeMsg] = useState(null)
  const [autoActivated, setAutoActivated] = useState(false)    // button momentary (5s)
  const [autoSuccessMsg, setAutoSuccessMsg] = useState(null)   // notification (persists)
  const [barriers, setBarriers] = useState({})
  const [barrierIntegrity, setBarrierIntegrity] = useState(null)
  const [sequenceDirection, setSequenceDirection] = useState(null) // 'opening' | 'closing' | null

  const [fusionZones, setFusionZones] = useState({})
  const [statuses, setStatuses] = useState({ ...DEFAULT_STATUSES })

  // Refs for gate sequence management
  const mcuBarriersRef = useRef({})
  const sequenceActiveRef = useRef(false)
  const sequenceTimersRef = useRef([])
  const prevOb2Ref = useRef(null)  // track OB2 {open, close} for edge detection
  const gateRef = useRef({ manualOverride: false })
  const cmdStreamRef = useRef(null)


  // ── Command bridge (send acks / commands to MCU) ────────────
  useEffect(() => {
    primeAlarm()
    const cmd = new CommandStream()
    cmd.connect(config.cmdWsUrl)
    cmdStreamRef.current = cmd
    return () => cmd.disconnect()
  }, [])

  // ── Fusion WebSocket (zone counts only) ─────────────────────
  useEffect(() => {
    const stream = new FusionStream({
      onData: (data) => {
        console.debug('[Fusion] received:', data)
        // Accept fusion_zones as nested object or zone keys at top level
        if (data.fusion_zones && typeof data.fusion_zones === 'object') {
          setFusionZones(data.fusion_zones)
        } else {
          // Fallback: check if zone keys (TZ1, CZ1, etc.) exist at top level
          const found = ZONE_KEYS.some(k => data[k] !== undefined)
          if (found) {
            const zones = {}
            for (const k of ZONE_KEYS) { if (data[k] !== undefined) zones[k] = data[k] }
            setFusionZones(zones)
          }
        }
      },
      onStatus: (wsStatus) => {
        if (wsStatus === 'open') {
          return
        }
        if (wsStatus === 'error' || wsStatus === 'closed' || wsStatus === 'stale') {
          setFusionZones({})
        }
      },
    })
    stream.connect(config.fusionWsUrl)
    return () => stream.disconnect()
  }, [])

  // ── MCU WebSocket (health, signals, barrier via mcu-bridge) ──
  useEffect(() => {
    const stream = new McuStream({
      onData: (data) => {
        console.debug('[MCU] received:', data)


        // signals → gate state (train signals for banner only)
        if (data.signals) {
          const s = data.signals
          // Reset cmd-bridge state when entering manual override
          if (s.manual_override && !gateRef.current.manualOverride) {
            cmdStreamRef.current?.send({ ...DEFAULT_COMMAND })
          }
          gateRef.current.manualOverride = Boolean(s.manual_override)
          const ack = s.auto_mode_ack
          setGate({
            manualOverride: Boolean(s.manual_override),
            manualOverrideReq: Boolean(s.manual_override_req),
            autoModeAck: (ack && ack !== 'NULL') ? ack : null,
            trainArriving: Boolean(s.train_arrival),
            trainDeparting: Boolean(s.train_departed),
          })
        }

        // health + barrier → single status update
        const next = {}

        // health: 0 = healthy, 1 = faulty
        if (data.health) {
          const h = data.health
          next.camera = h.camera ? 'unavailable' : 'healthy'
          next.radar = h.radar ? 'unavailable' : 'healthy'
          next.sensor = h.sensor ? 'faulty' : 'healthy'
          next.img_mpu = h.img_mpu ? 'unavailable' : 'healthy'
          next.mcu = h.mcu ? 'faulty' : 'healthy'
          next.dcdc = h.dcdc_converter ? 'faulty' : 'healthy'
        }

        if (data.barrier) {
          const integ = data.barrier.integrity || null
          setBarrierIntegrity(integ)
          next.barrier = (integ === 'BARRIER_OK' || integ === 'OK') ? 'healthy' : integ
          const gates = {}
          for (const [key, val] of Object.entries(data.barrier)) {
            if (key !== 'integrity' && typeof val === 'object') gates[key.toUpperCase()] = val
          }
          // All gates use OB2 signal for now
          const ob2 = gates.OB2
          if (ob2) {
            for (const name of ['OB1', 'OB3', 'OB4', 'IB1', 'IB2']) {
              gates[name] = ob2
            }

            // Detect OB2 state change → start gate sequence
            const prev = prevOb2Ref.current
            const newClose = ob2.close ? 1 : 0
            const newOpen = ob2.open ? 1 : 0
            const startClose = prev !== null && newClose === 1 && prev.close === 0
            const startOpen = prev !== null && newOpen === 1 && prev.open === 0

            if (startClose || startOpen) {
              const closing = startClose
              // Cancel any running sequence
              sequenceTimersRef.current.forEach(t => clearTimeout(t))
              sequenceTimersRef.current = []
              sequenceActiveRef.current = true
              setSequenceDirection(closing ? 'closing' : 'opening')

              const steps = closing ? CLOSE_STEPS : OPEN_STEPS
              const duration = closing ? CLOSE_DURATION : OPEN_DURATION
              steps.forEach(step => {
                const t = setTimeout(() => {
                  setBarriers(prevB => {
                    const updated = { ...prevB }
                    step.gates.forEach(g => {
                      updated[g] = { ...(updated[g] || {}), close: closing ? 1 : 0, open: closing ? 0 : 1, locked: 0 }
                    })
                    return updated
                  })
                }, step.delay)
                sequenceTimersRef.current.push(t)
              })

              // End sequence after full duration and sync with MCU
              const endTimer = setTimeout(() => {
                sequenceActiveRef.current = false
                setSequenceDirection(null)
                const latest = mcuBarriersRef.current
                if (Object.keys(latest).length > 0) {
                  setBarriers(latest)
                }
              }, duration)
              sequenceTimersRef.current.push(endTimer)
            }
            prevOb2Ref.current = { close: newClose, open: newOpen }
          }

          mcuBarriersRef.current = gates
          if (!sequenceActiveRef.current) {
            setBarriers(gates)
          }
        }

        setStatuses(prev => ({ ...prev, ...next }))
      },
      onStatus: (wsStatus) => {
        if (wsStatus === 'error' || wsStatus === 'closed' || wsStatus === 'stale') {

        }
      },
    })
    stream.connect(config.mcuWsUrl)
    return () => stream.disconnect()
  }, [])

  const { manualOverride, manualOverrideReq, trainArriving, trainDeparting } = gate

  // Send only the fields being changed — preserves other cmdState fields in bridge
  const sendCommand = (fields) => {
    cmdStreamRef.current?.send(fields)
  }

  const handleOverrideAck = () => sendCommand({ manual_override_ack: 1 })
  const handleClearError = () => sendCommand({ err_clear: 1 })

  const handleAutomatic = () => {
    // Check for active errors before sending request to MCU
    const errors = []
    for (const [id, val] of Object.entries(statuses)) {
      if (val === 'faulty') {
        errors.push(`${SUBSYSTEM_LABELS[id] || id} — FAULTY`)
      } else if (val === 'unavailable') {
        errors.push(`${SUBSYSTEM_LABELS[id] || id} — DATA UNAVAILABLE`)
      } else if (val && val !== 'healthy' && val !== false) {
        const match = val.match(/^ERR[_\s]*(.+)/i)
        if (match) {
          errors.push(`${match[1].toUpperCase()} Barrier Integrity Compromised!`)
        } else {
          errors.push(`${SUBSYSTEM_LABELS[id] || id} — ${val}`)
        }
      }
    }
    if (errors.length > 0) {
      setAutoModeMsg(errors.join('\n') + '\n\nNeed to be cleared to enter Automatic mode.')
      return
    }
    setAutoModeMsg(null)
    sendCommand({ auto_mode_req: 1 })
  }

  // ── Handle MCU auto_mode_ack response ──────────────────────
  useEffect(() => {
    const ack = gate.autoModeAck
    if (!ack) return
    if (ack === 'ACK') {
      setAutoModeMsg(null)
      setAutoActivated(true)
      setAutoSuccessMsg('The LC gate is now operating in automatic mode.')
      // ACK received — reset all cmd state back to defaults
      cmdStreamRef.current?.send({ ...DEFAULT_COMMAND })
      // Button reverts to normal after 5 s; notification stays until user dismisses
      const t = setTimeout(() => setAutoActivated(false), 5000)
      return () => clearTimeout(t)
    }
    // ERR_GATE_CLOSED — future scope, not handled now
  }, [gate.autoModeAck])

  // ── Auto-hide error toast ────────────────────────────────────
  useEffect(() => {
    if (autoModeMsg) {
      const t = setTimeout(() => setAutoModeMsg(null), 5000)
      return () => clearTimeout(t)
    }
  }, [autoModeMsg])

  // Cleanup sequence timers on unmount
  useEffect(() => {
    return () => {
      sequenceTimersRef.current.forEach(t => clearTimeout(t))
      sequenceTimersRef.current = []
    }
  }, [])

  const cameraUrl = config.cameraStreamUrl
  const radarUrl = config.radarStreamUrl

  // Derive a human-readable reason for the manual-override modal
  const overrideReason = (() => {
    const integ = barrierIntegrity
    if (integ && integ !== 'OK' && integ !== 'BARRIER_OK') {
      const match = String(integ).match(/^ERR[_\s]*(.+)/i)
      if (match) return `${match[1].toUpperCase()} Barrier Integrity Compromised`
      return String(integ)
    }
    for (const [id, val] of Object.entries(statuses)) {
      if (val === 'faulty') return `${SUBSYSTEM_LABELS[id] || id} Fault`
    }
    return null
  })()


  return (
    <div className="dashboard">
      {manualOverrideReq && !manualOverride && <div className="dashboard__alert-overlay" />}
      {manualOverrideReq && !manualOverride && (
        <ManualOverrideModal onAcknowledge={handleOverrideAck} errorMessage={overrideReason} />
      )}

      <div className={`dashboard__topbar${trainArriving || trainDeparting ? ' dashboard__topbar--train-active' : ''}`}>
        <SystemHeader />
        <GateStatusBar manualOverride={manualOverride} />

        {(trainArriving || trainDeparting) && (
          <div className={`dashboard__train-signal ${trainArriving ? 'dashboard__train-signal--arriving' : 'dashboard__train-signal--departing'}`}>
            {trainArriving ? 'TRAIN ARRIVING' : 'TRAIN DEPARTED'}
          </div>
        )}
      </div>

      <div className="dashboard__main">
        <div className="dashboard__col dashboard__col--left">
          <div className="camera-row">
            <CameraView title="Camera 1" streamUrl={cameraUrl} />
            <CameraView title="Camera 2" />
          </div>
          <div className="radar-row">
            <RadarView title="Radar 1" streamUrl={radarUrl} />
            <RadarView title="Radar 2" />
          </div>
        </div>
        <div className="dashboard__col dashboard__col--right">
          <TrackZoneMap fusionZones={fusionZones} barriers={barriers} />
          <GateOverview
            barriers={barriers}
            barrierIntegrity={barrierIntegrity}
            statuses={statuses}
            onClearError={handleClearError}
            sequenceDirection={sequenceDirection}
          />
        </div>
      </div>

      {/* ── Toast notification — bottom-right ─────────────── */}
      {autoModeMsg && (
        <div className="dashboard__toast">
          <div className="dashboard__toast-icon">⚠</div>
          <div className="dashboard__toast-body">
            <span className="dashboard__toast-title">Action Required</span>
            <span className="dashboard__toast-text">{autoModeMsg}</span>
          </div>
          <button className="dashboard__toast-close" onClick={() => setAutoModeMsg(null)}>✕</button>
        </div>
      )}

      {/* ── Success toast — persists until user dismisses ──── */}
      {autoSuccessMsg && (
        <div className="dashboard__toast dashboard__toast--success">
          <div className="dashboard__toast-icon dashboard__toast-icon--success">✓</div>
          <div className="dashboard__toast-body">
            <span className="dashboard__toast-title">Automatic Mode Activated</span>
            <span className="dashboard__toast-text dashboard__toast-text--success">
              {autoSuccessMsg}
            </span>
          </div>
          <button className="dashboard__toast-close" onClick={() => setAutoSuccessMsg(null)}>✕</button>
        </div>
      )}

      <div className="dashboard__bottombar">
        <button
          className={`dashboard__auto-btn${autoActivated ? ' dashboard__auto-btn--activated' : ''}`}
          onClick={handleAutomatic}
          disabled={!manualOverride || autoActivated}
        >
          {autoActivated ? 'AUTOMATIC MODE ACTIVATED' : 'AUTOMATIC MODE'}
        </button>
      </div>
    </div>
  )
}
