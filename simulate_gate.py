"""
Gate simulation server.

Toggles the gate between open and closed every few seconds so you can
test the barrier animation and zone counts on the frontend dashboard.

    python simulate_gate.py

Serves on http://localhost:8001 by default.
Set VITE_SERVER_URL=http://localhost:8001 in .env.local to match.
"""

import asyncio
import json
import random
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
import uvicorn


@asynccontextmanager
async def lifespan(app):
    task1 = asyncio.create_task(gate_cycle())
    task2 = asyncio.create_task(broadcast_fusion())
    yield
    task1.cancel()
    task2.cancel()

app = FastAPI(lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Shared state ──────────────────────────────────────────────────────────────

gate_state = {
    "manualOverride": False,
    "trainArriving": False,
    "trainDeparting": False,
    "trainDirection": None,
}

ZONE_KEYS = ["CZ1", "CZ2", "IZ1", "IZ2", "TZ1", "TZ2"]

# ── Gate status endpoint (polled by frontend) ────────────────────────────────

@app.get("/api/gate/status")
async def get_gate_status():
    return gate_state

# ── Fusion WebSocket (zone counts) ───────────────────────────────────────────

ws_clients: list[WebSocket] = []

@app.websocket("/ws/fusion")
async def websocket_fusion(ws: WebSocket):
    await ws.accept()
    ws_clients.append(ws)
    try:
        while True:
            data = await ws.receive_text()
            # ignore client messages
    except WebSocketDisconnect:
        ws_clients.remove(ws)

async def broadcast_fusion():
    """Send random fusion zone counts to all connected clients."""
    while True:
        payload = {
            "timestamp": time.strftime("%Y-%m-%d %H:%M:%S"),
            "fusion_zones": {k: random.randint(0, 3) for k in ZONE_KEYS},
        }
        msg = json.dumps(payload)
        dead = []
        for ws in ws_clients:
            try:
                await ws.send_text(msg)
            except Exception:
                dead.append(ws)
        for ws in dead:
            ws_clients.remove(ws)
        await asyncio.sleep(1)

# ── Gate toggle loop ─────────────────────────────────────────────────────────

OPEN_SECONDS  = 6   # gate stays open
CLOSE_SECONDS = 5   # gate stays closed

async def gate_cycle():
    """Cycle: open → train arriving → closed → train departing → open."""
    while True:
        # ── Gate open ─────────────────────────────────────────────────
        gate_state["trainArriving"]  = False
        gate_state["trainDeparting"] = False
        gate_state["trainDirection"] = None
        print("[SIM] Gate OPEN")
        await asyncio.sleep(OPEN_SECONDS)

        # ── Train arriving → gate closes ──────────────────────────────
        gate_state["trainArriving"]  = True
        gate_state["trainDirection"] = "north"
        print("[SIM] Train ARRIVING — gate closing")
        await asyncio.sleep(CLOSE_SECONDS)

        # ── Train departing → gate opens ──────────────────────────────
        gate_state["trainArriving"]  = False
        gate_state["trainDeparting"] = True
        print("[SIM] Train DEPARTING — gate opening")
        await asyncio.sleep(3)

# ── Startup ───────────────────────────────────────────────────────────────────

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8001)
