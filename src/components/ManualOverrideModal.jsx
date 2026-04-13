import { useState, useEffect } from 'react'
import '../styles/ManualOverrideModal.css'
import { startAlarm, stopAlarm } from '../utils/alarm'

export default function ManualOverrideModal({ onAcknowledge, errorMessage }) {
  const [ackSent, setAckSent] = useState(false)

  // Alarm starts the instant the modal mounts (audio ctx is primed app-wide)
  // and stops on unmount or after acknowledgement.
  useEffect(() => {
    if (ackSent) {
      stopAlarm()
      return
    }
    startAlarm()
    return () => stopAlarm()
  }, [ackSent])

  const handleClick = () => {
    setAckSent(true)
    onAcknowledge()
  }

  const reason = errorMessage || 'an operator request'

  return (
    <div className="mo-modal">
      <div className="mo-modal__card">
        <h2 className="mo-modal__title">MANUAL OVERRIDE REQUESTED</h2>
        <div className="mo-modal__desc">
          <p>Manual Override Requested due to the <span className="mo-modal__reason">{reason}</span>.</p>
          <p>This needs manual intervention and monitoring to assess the ground situation.</p>
          <p>Please initiate to take control of the LC gate using the Camera feed and Radar feed available.</p>
        </div>
        <button
          className="mo-modal__btn"
          onClick={handleClick}
          disabled={ackSent}
        >
          {ackSent ? 'WAITING...' : 'ACKNOWLEDGE'}
        </button>
      </div>
    </div>
  )
}
