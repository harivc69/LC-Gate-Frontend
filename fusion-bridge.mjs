#!/usr/bin/env node
/**
 * Fusion TCP → WebSocket bridge
 *
 * Connects to the Fusion TCP server, reads newline-delimited JSON,
 * and broadcasts each message to all connected WebSocket clients.
 *
 * Usage:  node fusion-bridge.mjs
 * Env:    FUSION_HOST (default 192.168.1.103)
 *         FUSION_PORT (default 8080)
 *         WS_PORT     (default 4501)
 */
import net from 'node:net'
import { WebSocketServer } from 'ws'

const FUSION_HOST  = process.env.FUSION_HOST || '192.168.1.100'
const FUSION_PORT  = Number(process.env.FUSION_PORT || 8080)
const WS_PORT      = Number(process.env.WS_PORT || 4501)
const RECONNECT_MS = 3000

// ── WebSocket server ─────────────────────────────────────────
const wss = new WebSocketServer({ port: WS_PORT })
const clients = new Set()
let lastData = null

wss.on('connection', (ws) => {
  clients.add(ws)
  console.log(`[WS] Client connected (${clients.size} total)`)
  if (lastData) ws.send(lastData)
  ws.on('close', () => {
    clients.delete(ws)
    console.log(`[WS] Client disconnected (${clients.size} total)`)
  })
})

function broadcast(json) {
  lastData = json
  for (const ws of clients) {
    if (ws.readyState === 1) ws.send(json)
  }
}

console.log(`[WS] Listening on ws://localhost:${WS_PORT}`)

// ── TCP client to Fusion server ──────────────────────────────
let buf = ''
let reconnecting = false

function connect() {
  reconnecting = false
  const sock = new net.Socket()
  sock.setKeepAlive(true, 5000)

  console.log(`[TCP] Connecting to ${FUSION_HOST}:${FUSION_PORT}...`)

  sock.connect(FUSION_PORT, FUSION_HOST, () => {
    console.log(`[TCP] Connected to Fusion ${FUSION_HOST}:${FUSION_PORT}`)
    buf = ''
  })

  sock.on('data', (chunk) => {
    buf += chunk.toString()

    // Newline-delimited JSON
    let idx
    while ((idx = buf.indexOf('\n')) !== -1) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      tryParse(line)
    }

    // Brace matching for JSON without trailing newline
    const trimmed = buf.trim()
    if (trimmed.startsWith('{')) {
      let depth = 0, end = -1
      for (let i = 0; i < trimmed.length; i++) {
        if (trimmed[i] === '{') depth++
        else if (trimmed[i] === '}') { depth--; if (depth === 0) { end = i; break } }
      }
      if (end !== -1) {
        const json = trimmed.slice(0, end + 1)
        buf = trimmed.slice(end + 1)
        tryParse(json)
      }
    }
  })

  function tryParse(str) {
    try {
      JSON.parse(str)
      broadcast(str)
    } catch { /* skip malformed */ }
  }

  function scheduleReconnect() {
    if (reconnecting) return
    reconnecting = true
    console.log(`[TCP] Reconnecting in ${RECONNECT_MS}ms...`)
    setTimeout(connect, RECONNECT_MS)
  }

  sock.on('close', () => {
    console.log('[TCP] Connection closed')
    scheduleReconnect()
  })

  sock.on('error', (err) => {
    console.log(`[TCP] Error: ${err.message}`)
    sock.destroy()
  })
}

connect()
