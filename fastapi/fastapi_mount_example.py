# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

import asyncio
from pathlib import Path
from typing import TYPE_CHECKING

import uvicorn

from fastapi import FastAPI, Request, Response
from fastapi.responses import JSONResponse, RedirectResponse
from streamlit import config as _config
from streamlit.web.server.server import Server
from streamlit.web.server.starlette.starlette_app import create_starlette_app

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

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
_runtime_task: asyncio.Task[None] | None = None


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


@app.middleware("http")
async def set_cookie_with_middleware(
    request: Request, call_next: Callable[[Request], Awaitable[Response]]
) -> Response:
    """Example middleware that scopes a cookie to /app responses."""

    response = await call_next(request)
    if request.url.path.startswith("/app"):
        response.set_cookie(
            key="streamlit-middleware",
            value="streamlit-path-cookie",
            path="/app",
            httponly=True,
            max_age=3600,
        )
    return response


app.mount("/app", streamlit_starlette, name="app")


@app.get("/", include_in_schema=False)
async def root() -> RedirectResponse:
    return RedirectResponse("/app/")


@app.get("/set-cookie", include_in_schema=False)
async def set_streamlit_cookie() -> RedirectResponse:
    """Example endpoint that sets a cookie scoped to the /app path."""

    response = RedirectResponse("/app/")
    response.set_cookie(
        key="streamlit-demo",
        value="mounted-with-fastapi",
        path="/app",
        httponly=True,
        max_age=3600,
    )
    return response


if __name__ == "__main__":
    uvicorn.run(app, host="127.0.0.1", port=8000, log_level="info")
