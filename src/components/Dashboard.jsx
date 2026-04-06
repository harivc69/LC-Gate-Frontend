import { useState, useEffect } from 'react'
import '../styles/Dashboard.css'
import SystemHeader  from './SystemHeader'
import GateStatusBar from './GateStatusBar'
import CameraView    from './CameraView'
import RadarView     from './RadarView'
import TrackZoneMap  from './TrackZoneMap'

const STATUS_URL = `${import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'}/api/gate/status`

export default function Dashboard() {
  const [gate, setGate] = useState({
    manualOverride: false,
    trainArriving:  false,
    trainDeparting: false,
    trainDirection: null,
  })

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch(STATUS_URL)
        if (res.ok && active) {
          const data = await res.json()
          setGate(prev => ({ ...prev, ...data }))
        }
      } catch {
        // backend not yet reachable — keep last known state
      }
    }

    poll()
    const id = setInterval(poll, 2000)
    return () => { active = false; clearInterval(id) }
  }, [])

  const { manualOverride, trainArriving, trainDeparting, trainDirection } = gate

  return (
    <div className="dashboard">
      {manualOverride && <div className="dashboard__alert-overlay" />}

      <SystemHeader />

      <GateStatusBar
        trainArriving={trainArriving}
        trainDeparting={trainDeparting}
        trainDirection={trainDirection}
        manualOverride={manualOverride}
      />

      <div className="dashboard__main">
        <div className="dashboard__col dashboard__col--left">
          <CameraView />
          <RadarView />
        </div>
        <div className="dashboard__col dashboard__col--right">
          <TrackZoneMap
            trainArriving={trainArriving}
            trainDeparting={trainDeparting}
          />
        </div>
      </div>
    </div>
  )
}
