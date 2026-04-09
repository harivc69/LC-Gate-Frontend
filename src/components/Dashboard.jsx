import { useState, useEffect } from 'react'
import '../styles/Dashboard.css'
import config from '../config'
import SystemHeader, { DEFAULT_STATUSES } from './SystemHeader'
import GateStatusBar from './GateStatusBar'
import CameraView from './CameraView'
import RadarView from './RadarView'
import TrackZoneMap from './TrackZoneMap'
import { FusionStream } from '../services/FusionStream'

export default function Dashboard() {
  const [gate, setGate] = useState({
    manualOverride: false,
    trainArriving: false,
    trainDeparting: false,
    trainDirection: null,
  })
  const [fusionZones, setFusionZones] = useState({})
  const [statuses, setStatuses] = useState(DEFAULT_STATUSES)

  useEffect(() => {
    const stream = new FusionStream({
      onData: (data) => {
        // ── Fusion zone counts ──────────────────────────────────
        if (data.fusion_zones) setFusionZones(data.fusion_zones)

        // ── Gate state (live from backend) ──────────────────────
        if (data.gate) {
          setGate(prev => ({ ...prev, ...data.gate }))
        }

        // ── Subsystem health ────────────────────────────────────
        if (data.health) {
          const h = data.health
          setStatuses(prev => ({
            ...prev,
            camera:  h.CS !== undefined ? 'active' : 'offline',
            radar:   h.RS !== undefined ? 'active' : 'offline',
            jetson:  h.JS !== undefined ? 'active' : 'offline',
            dcdc:    h.DS !== undefined ? 'active' : prev.dcdc,
            mcu:     h.MS !== undefined ? 'active' : prev.mcu,
            sensor:  h.SS !== undefined ? 'active' : prev.sensor,
            barrier: h.BS !== undefined ? 'active' : prev.barrier,
          }))
        }
      },
      onStatus: (wsStatus) => {
        if (wsStatus === 'connecting') {
          setStatuses(prev => {
            const next = { ...prev }
            for (const key of Object.keys(next)) {
              if (next[key] === 'offline') next[key] = 'connecting'
            }
            return next
          })
          return
        }
        if (wsStatus === 'open') {
          setStatuses(prev => ({ ...prev, network: 'active', jetson: 'active' }))
          return
        }
        // error, closed, or stale — connection is dead
        setFusionZones({})
        setGate({
          manualOverride: false,
          trainArriving: false,
          trainDeparting: false,
          trainDirection: null,
        })
        setStatuses(DEFAULT_STATUSES)
      },
    })
    stream.connect(config.serverUrl)
    return () => stream.disconnect()
  }, [])

  const { manualOverride, trainArriving, trainDeparting, trainDirection } = gate

  // Only pass stream URLs when the backend confirms the subsystem is alive.
  // This ensures feeds show OFFLINE (not a stale last frame) when the server is down.
  const cameraUrl = statuses.camera === 'active' ? config.cameraStreamUrl : null
  const radarUrl  = statuses.radar  === 'active' ? config.radarStreamUrl  : null

  return (
    <div className="dashboard">
      {manualOverride && <div className="dashboard__alert-overlay" />}

      <SystemHeader statuses={statuses} />

      <GateStatusBar
        trainArriving={trainArriving}
        trainDeparting={trainDeparting}
        trainDirection={trainDirection}
        manualOverride={manualOverride}
      />

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
          <TrackZoneMap fusionZones={fusionZones} gateOpen={!trainArriving && !trainDeparting} />
        </div>
      </div>
    </div>
  )
}
