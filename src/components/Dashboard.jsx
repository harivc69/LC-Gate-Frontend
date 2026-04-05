import '../styles/Dashboard.css'
import SystemHeader from './SystemHeader'
import GateStatusBar from './GateStatusBar'
import CameraView from './CameraView'
import RadarView from './RadarView'
import TrackZoneMap from './TrackZoneMap'
import { useGateStatus } from '../hooks/useGateStatus'

export default function Dashboard() {
  const { manualOverride, trainArriving, trainDeparting, trainDirection } = useGateStatus()

  return (
    <div className="dashboard">

      {/* Full-viewport red-border blink when gate is under manual control */}
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
