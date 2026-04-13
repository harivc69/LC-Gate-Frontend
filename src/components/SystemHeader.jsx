import { useState, useEffect } from 'react'
import '../styles/SystemHeader.css'

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function SystemHeader() {
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
    </header>
  )
}
