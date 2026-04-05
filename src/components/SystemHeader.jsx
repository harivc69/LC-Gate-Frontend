import { useState, useEffect } from 'react'
import '../styles/SystemHeader.css'

// Monitored subsystem definitions
const SUBSYSTEMS = [
  { id: 'camera',  label: 'CAM'    },
  { id: 'radar',   label: 'RADAR'  },
  { id: 'gate',    label: 'GATE'   },
  { id: 'network', label: 'NET'    },
  { id: 'server',  label: 'SRV'    },
  { id: 'sensor',  label: 'SENSOR' },
]

const DEFAULT_STATUSES = {
  camera:  true,
  radar:   true,
  gate:    true,
  network: true,
  server:  true,
  sensor:  true,
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function SubsystemIndicator({ label, online }) {
  return (
    <div className="subsys-indicator">
      <span className={`subsys-indicator__dot ${online ? 'subsys-indicator__dot--ok' : 'subsys-indicator__dot--fault'}`} />
      <span className="subsys-indicator__label">{label}</span>
    </div>
  )
}

// statuses prop: { camera: bool, radar: bool, gate: bool, network: bool, server: bool, sensor: bool }
export default function SystemHeader({ statuses = DEFAULT_STATUSES }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const dateStr = now.toISOString().slice(0, 10)

  return (
    <header className="sys-header">
      <div className="sys-header__brand">
        <span className="sys-header__title">LC GATE</span>
        <span className="sys-header__subtitle">LEVEL CROSSING MONITORING SYSTEM</span>
      </div>

      <div className="sys-header__clock">
        <span className="sys-header__time">{timeStr}</span>
        <span className="sys-header__date">{dateStr}</span>
      </div>

      <div className="sys-header__subsystems">
        {SUBSYSTEMS.map(s => (
          <SubsystemIndicator
            key={s.id}
            label={s.label}
            online={Boolean(statuses[s.id])}
          />
        ))}
      </div>
    </header>
  )
}
