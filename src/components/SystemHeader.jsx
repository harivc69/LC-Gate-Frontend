import { useState, useEffect } from 'react'
import '../styles/SystemHeader.css'

const SUBSYSTEMS = [
  { id: 'camera', label: 'CAMERA' },
  { id: 'radar', label: 'RADAR' },
  { id: 'dcdc', label: 'DCDC' },
  { id: 'mcu', label: 'MCU' },
  { id: 'sensor', label: 'SENSOR' },
  { id: 'network', label: 'NETWORK' },
  { id: 'jetson', label: 'IMG.MCU' },
  { id: 'barrier', label: 'BARRIER\nINTEGRITY' },
]

export const DEFAULT_STATUSES = {
  camera: false,
  radar: false,
  dcdc: false,
  mcu: false,
  sensor: false,
  network: false,
  jetson: false,
  barrier: false,
}

function pad(n) {
  return String(n).padStart(2, '0')
}

function SubsystemIndicator({ label, online }) {
  const lines = label.split('\n')
  return (
    <div className="subsys-indicator">
      <span className={`subsys-indicator__dot ${online ? 'subsys-indicator__dot--ok' : 'subsys-indicator__dot--fault'}`} />
      <div className="subsys-indicator__label">
        {lines.map((line, idx) => (
          <span key={idx}>{line}</span>
        ))}
      </div>
    </div>
  )
}

// statuses prop: { camera: bool, radar: bool, dcdc: bool, mcu: bool, sensor: bool, network: bool, jetson: bool }
export default function SystemHeader({ statuses = DEFAULT_STATUSES }) {
  const [now, setNow] = useState(new Date())

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`
  const dateStr = `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`

  return (
    <header className="sys-header">
      <div className="sys-header__brand">
        <span className="sys-header__title">LC GATE</span>
      </div>

      <div className="sys-header__clock">
        <span className="sys-header__time">{timeStr}</span>
        <span className="sys-header__clock-sep">|</span>
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
