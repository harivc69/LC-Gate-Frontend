#!/usr/bin/env node
/**
 * Command bridge — Dashboard → MCU
 *
 * TCP SERVER on port 8181: MCU connects here to receive commands.
 * WS  SERVER on port 4502: Dashboard sends state updates.
 *
 * Continuously sends the command state JSON to the MCU every second.
 * Default:  {"manual_override_ack":0,"err_clear":0,"auto_mode_req":0}
 * Dashboard updates fields via WebSocket (e.g. manual_override_ack → 1).
 *
 * Usage:  node cmd-bridge.mjs
 * Env:    CMD_PORT     (default 8181)
 *         CMD_WS_PORT  (default 4502)
 *         SEND_INTERVAL (default 1000 ms)
 */
import net from 'node:net'
import { WebSocketServer } from 'ws'

const CMD_PORT      = Number(process.env.CMD_PORT || 8181)
const WS_PORT       = Number(process.env.CMD_WS_PORT || 4502)
const SEND_INTERVAL = Number(process.env.SEND_INTERVAL || 1000)

// ── Command state — sent continuously to MCU ────────────────
let cmdState = {
  manual_override_ack: 0,
  err_clear: 0,
  auto_mode_req: 0,
}

// ── TCP server — MCU connects here ──────────────────────────
let mcuClient = null
let sendTimer = null

function startSending(socket) {
  stopSending()
  // Send immediately on connect
  sendToMcu(socket)
  // Then keep sending at interval
  sendTimer = setInterval(() => sendToMcu(socket), SEND_INTERVAL)
}

function stopSending() {
  if (sendTimer) {
    clearInterval(sendTimer)
    sendTimer = null
  }
}

function sendToMcu(socket) {
  if (!socket || socket.destroyed) return
  const payload = JSON.stringify(cmdState)
  socket.write(payload + '\n')
}

const tcpServer = net.createServer((socket) => {
  const addr = `${socket.remoteAddress}:${socket.remotePort}`
  console.log(`[TCP] MCU connected from ${addr}`)
  mcuClient = socket
  startSending(socket)

  socket.on('data', (chunk) => {
    console.log(`[TCP-RX] From MCU: ${chunk.toString().trim()}`)
  })

  socket.on('close', () => {
    console.log(`[TCP] MCU disconnected (${addr})`)
    if (mcuClient === socket) {
      mcuClient = null
      stopSending()
    }
  })

  socket.on('error', (err) => {
    console.log(`[TCP] Error: ${err.message}`)
    if (mcuClient === socket) {
      mcuClient = null
      stopSending()
    }
  })
})

tcpServer.listen(CMD_PORT, '0.0.0.0', () => {
  console.log(`[TCP] Server listening on 0.0.0.0:${CMD_PORT}`)
})

// ── WebSocket server — Dashboard connects here ──────────────
const wss = new WebSocketServer({ port: WS_PORT })

wss.on('connection', (ws) => {
  console.log(`[WS] Dashboard connected  |  MCU: ${mcuClient ? 'CONNECTED' : 'WAITING'}`)
  // Send current state to dashboard so it knows
  ws.send(JSON.stringify(cmdState))

  ws.on('message', (msg) => {
    try {
      const update = JSON.parse(msg.toString())
      cmdState = { ...cmdState, ...update }
      console.log(`[WS] State updated: ${JSON.stringify(cmdState)}`)
      // Send updated state to MCU immediately (don't wait for interval)
      if (mcuClient && !mcuClient.destroyed) {
        sendToMcu(mcuClient)
      }
    } catch {
      console.log(`[WS] Invalid JSON: ${msg.toString()}`)
    }
  })

  ws.on('close', () => console.log('[WS] Dashboard disconnected'))
})

console.log(`[WS] Listening on ws://localhost:${WS_PORT}`)
console.log(`[TX] Sending state to MCU every ${SEND_INTERVAL}ms`)
console.log(`[TX] Default: ${JSON.stringify(cmdState)}`)
