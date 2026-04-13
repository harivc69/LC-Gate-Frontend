#!/usr/bin/env node
/**
 * MCU TCP → WebSocket bridge
 *
 * Connects to the MCU TCP server, reads newline-delimited JSON,
 * and broadcasts each message to all connected WebSocket clients.
 *
 * Usage:  node mcu-bridge.mjs
 * Env:    MCU_HOST (default 192.168.1.200)
 *         MCU_PORT (default 8888)
 *         WS_PORT  (default 4500)
 */
import net from 'node:net'
import { WebSocketServer } from 'ws'

const MCU_HOST = process.env.MCU_HOST || '192.168.1.200'
const MCU_PORT = Number(process.env.MCU_PORT || 8888)
const WS_PORT = Number(process.env.WS_PORT || 4500)
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

// ── TCP client to MCU ────────────────────────────────────────
let buf = ''
let reconnecting = false

function connect() {
  reconnecting = false
  const sock = new net.Socket()
  sock.setKeepAlive(true, 5000)

  console.log(`[TCP] Connecting to ${MCU_HOST}:${MCU_PORT}...`)

  sock.connect(MCU_PORT, MCU_HOST, () => {
    console.log(`[TCP] Connected to MCU ${MCU_HOST}:${MCU_PORT}`)
    buf = ''
  })

  sock.on('data', (chunk) => {
    const raw = chunk.toString()
    console.log(`[TCP-RX] ${new Date().toISOString()} | Received ${chunk.length} bytes from ${MCU_HOST}:${MCU_PORT}`)
    console.log(`[TCP-RX] Raw data: ${raw}`)
    buf += raw

    // MCU sends pretty-printed (multi-line) JSON — use brace matching
    // to extract complete JSON objects from the buffer
    let safety = 0
    while (safety++ < 50) {
      // Skip leading whitespace/newlines
      const start = buf.search(/\S/)
      if (start === -1) { buf = ''; break }
      buf = buf.slice(start)

      if (buf[0] !== '{') {
        // Discard non-JSON data up to the next '{'
        const nextBrace = buf.indexOf('{')
        if (nextBrace === -1) { buf = ''; break }
        buf = buf.slice(nextBrace)
      }

      // Find matching closing brace
      let depth = 0, end = -1, inString = false, escape = false
      for (let i = 0; i < buf.length; i++) {
        const ch = buf[i]
        if (escape) { escape = false; continue }
        if (ch === '\\' && inString) { escape = true; continue }
        if (ch === '"') { inString = !inString; continue }
        if (inString) continue
        if (ch === '{') depth++
        else if (ch === '}') { depth--; if (depth === 0) { end = i; break } }
      }

      if (end === -1) break // incomplete object, wait for more data

      const json = buf.slice(0, end + 1)
      buf = buf.slice(end + 1)
      tryParse(json)
    }
  })

  function tryParse(str) {
    try {
      const parsed = JSON.parse(str)
      console.log(`[TCP-RX] Parsed JSON: ${JSON.stringify(parsed)}`)
      broadcast(str)
    } catch (e) {
      console.log(`[TCP-RX] Malformed data (skipped): ${str}`)
    }
  }

  function scheduleReconnect() {
    if (reconnecting) return
    reconnecting = true
    console.log(`[TCP] Reconnecting in ${RECONNECT_MS}ms...`)
    setTimeout(connect, RECONNECT_MS)
  }

  sock.on('close', () => {
    console.log('[TCP] Connection closed')
    lastData = null
    scheduleReconnect()
  })

  sock.on('error', (err) => {
    console.log(`[TCP] Error: ${err.message}`)
    sock.destroy()
  })
}

connect()
