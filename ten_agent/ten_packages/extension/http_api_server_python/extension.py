"""HTTP API Server for TEN Agent"""
import asyncio
import uuid
from typing import Dict
from aiohttp import web


class HttpApiServerExtension:
    def __init__(self, name: str):
        self.name = name
        self.sessions: Dict[str, Dict] = {}
        self.app = web.Application()
        self.runner = None
        self.host = "0.0.0.0"
        self.port = 8080
        
        self.app.router.add_post("/start", self.handle_start)
        self.app.router.add_post("/stop", self.handle_stop)
        self.app.router.add_post("/reload-hotwords", self.handle_reload_hotwords)
        self.app.router.add_get("/health", self.handle_health)
    
    async def start(self):
        self.runner = web.AppRunner(self.app)
        await self.runner.setup()
        site = web.TCPSite(self.runner, self.host, self.port)
        await site.start()
        print(f"HTTP API Server on {self.host}:{self.port}")
    
    async def stop(self):
        if self.runner:
            await self.runner.cleanup()

    async def handle_start(self, request: web.Request):
        data = await request.json()
        user_id = data.get("user_id")
        if not user_id:
            return web.json_response({"error": "user_id required"}, status=400)
        session_id = str(uuid.uuid4())
        self.sessions[session_id] = {"user_id": user_id, "websocket_port": 8765}
        return web.json_response({"session_id": session_id, "websocket_port": 8765})
    
    async def handle_stop(self, request: web.Request):
        data = await request.json()
        session_id = data.get("session_id")
        if session_id not in self.sessions:
            return web.json_response({"error": "Invalid session_id"}, status=404)
        session = self.sessions.pop(session_id)
        return web.json_response({"success": True, "user_id": session["user_id"]})
    
    async def handle_reload_hotwords(self, request: web.Request):
        return web.json_response({"success": True})
    
    async def handle_health(self, request: web.Request):
        return web.json_response({"status": "ok", "active_sessions": len(self.sessions)})
