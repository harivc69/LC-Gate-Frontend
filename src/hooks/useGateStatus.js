import { useState, useEffect } from 'react'

const BASE = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000'
const STATUS_URL = `${BASE}/api/gate/status`

/**
 * Polls the gate status endpoint every 2 s.
 * Swap the fetch() call for a WebSocket subscription when the backend supports it.
 *
 * Expected response shape from the backend:
 * {
 *   manualOverride : boolean,             // gate is under manual operator control
 *   trainArriving  : boolean,             // train detected approaching the crossing
 *   trainDeparting : boolean,             // train detected clearing the crossing
 *   trainDirection : 'north'|'south'|null // track direction of travel
 * }
 *
 * Direction convention (matches SVG layout in TrackZoneMap):
 *   'north' → train approaching from the left  side of the track map
 *   'south' → train approaching from the right side of the track map
 */
export function useGateStatus() {
  const [status, setStatus] = useState({
    manualOverride: true,
    trainArriving: true,
    trainDeparting: true,
    trainDirection: 'north',
  })

  useEffect(() => {
    let active = true

    async function poll() {
      try {
        const res = await fetch(STATUS_URL)
        if (res.ok && active) {
          const data = await res.json()
          setStatus(prev => ({ ...prev, ...data }))
        }
      } catch {
        // backend not yet reachable — keep last known state
      }
    }

    poll()
    const id = setInterval(poll, 2000)
    return () => { active = false; clearInterval(id) }
  }, [])

  return status
}
