# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""E2E test for st.App with advanced configurations.

This tests custom routes, middleware, lifespan hooks, and exception handlers.
"""

from __future__ import annotations

from contextlib import asynccontextmanager
from typing import TYPE_CHECKING, Any

from starlette.middleware import Middleware
from starlette.responses import JSONResponse
from starlette.routing import Route

import streamlit as st

if TYPE_CHECKING:
    from collections.abc import AsyncIterator

    from starlette.requests import Request


# Track lifespan events for testing
_lifespan_events: list[str] = []


class CustomAPIError(Exception):
    """Custom exception for testing exception handlers."""

    def __init__(self, message: str, error_code: int = 400) -> None:
        self.message = message
        self.error_code = error_code
        super().__init__(message)


class CustomHeaderMiddleware:
    """Middleware that adds a custom header to all HTTP responses."""

    def __init__(self, app: Any) -> None:
        self.app = app

    async def __call__(self, scope: dict[str, Any], receive: Any, send: Any) -> None:
        if scope["type"] != "http":
            await self.app(scope, receive, send)
            return

        async def send_wrapper(message: dict[str, Any]) -> None:
            if message["type"] == "http.response.start":
                headers = list(message.get("headers", []))
                headers.append((b"x-custom-middleware", b"active"))
                message["headers"] = headers
            await send(message)

        await self.app(scope, receive, send_wrapper)


# --- Custom routes ---
async def api_data(request: Request) -> JSONResponse:  # noqa: ARG001
    """Return test data from a custom API endpoint."""
    return JSONResponse(
        {"items": ["apple", "banana", "cherry"], "count": 3, "source": "custom_route"}
    )


async def api_lifespan_check(request: Request) -> JSONResponse:  # noqa: ARG001
    """Return lifespan events to verify startup hook was called."""
    return JSONResponse({"events": _lifespan_events})


async def api_error(request: Request) -> JSONResponse:  # noqa: ARG001
    """Raise a custom exception to test exception handlers."""
    raise CustomAPIError("Something went wrong", error_code=422)


# --- Exception handlers ---
async def custom_api_error_handler(
    request: Request,  # noqa: ARG001
    exc: CustomAPIError,
) -> JSONResponse:
    """Return a structured JSON response for CustomAPIError exceptions."""
    return JSONResponse(
        {"error": exc.message, "code": exc.error_code, "handled_by": "custom_handler"},
        status_code=exc.error_code,
    )


# --- Lifespan hooks ---
@asynccontextmanager
async def lifespan(app: st.App) -> AsyncIterator[dict[str, Any]]:  # noqa: ARG001
    """Track startup and shutdown events via lifespan context manager."""
    _lifespan_events.append("startup")
    yield {"initialized": True}
    _lifespan_events.append("shutdown")


# --- Create the ASGI app ---
app = st.App(
    "st_app_advanced_script.py",
    routes=[
        Route("/api/data", api_data),
        Route("/api/lifespan", api_lifespan_check),
        Route("/api/error", api_error),
    ],
    middleware=[Middleware(CustomHeaderMiddleware)],
    lifespan=lifespan,
    exception_handlers={CustomAPIError: custom_api_error_handler},  # type: ignore[dict-item]
)
