import '../styles/Dashboard.css'
import SystemHeader from './SystemHeader'
import CameraView   from './CameraView'
import RadarView    from './RadarView'
import TrackZoneMap from './TrackZoneMap'

export default function Dashboard() {
  return (
    <div className="dashboard">
      <SystemHeader />
      <div className="dashboard__main">
        <div className="dashboard__col dashboard__col--left">
          <CameraView />
          <RadarView />
        </div>
        <div className="dashboard__col dashboard__col--right">
          <TrackZoneMap />
        </div>
      </div>
    </div>
  )
}
