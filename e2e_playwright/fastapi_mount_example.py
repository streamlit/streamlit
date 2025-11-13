from __future__ import annotations

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING

import uvicorn
from fastapi import FastAPI
from fastapi.responses import JSONResponse, RedirectResponse

from streamlit import config as _config
from streamlit.web.server.server import Server
from streamlit.web.server.starlette_app import create_starlette_app

if TYPE_CHECKING:
    from asyncio import Task

    from starlette.applications import Starlette

_STREAMLIT_SCRIPT = Path(__file__).with_name("fastapi_streamlit_app.py")


def _build_streamlit_starlette() -> tuple[Server, Starlette]:
    _config.set_option("server.useStarlette", True)
    _config.set_option("server.headless", True)
    _config.set_option("server.baseUrlPath", "")
    _config.set_option("global.developmentMode", False)
    _config.set_option("server.enableStaticServing", True)

    server = Server(str(_STREAMLIT_SCRIPT), is_hello=False)
    starlette_app = create_starlette_app(server._runtime)
    return server, starlette_app


server, streamlit_starlette = _build_streamlit_starlette()

app = FastAPI()
_runtime_task: Task[None] | None = None


@app.on_event("startup")
async def start_streamlit_runtime() -> None:
    global _runtime_task  # noqa: PLW0603
    _runtime_task = asyncio.create_task(server._runtime.start())


@app.on_event("shutdown")
async def stop_streamlit_runtime() -> None:
    server._runtime.stop()
    if _runtime_task is not None:
        await _runtime_task


@app.get("/api/status")
async def status() -> JSONResponse:
    return JSONResponse({"ok": True})


app.mount("/streamlit", streamlit_starlette, name="streamlit")


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/streamlit/")


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
