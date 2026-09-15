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

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform type checking tests for st.App. These are checked by mypy and ty,
# never executed at runtime.
if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Callable
    from contextlib import AbstractAsyncContextManager, asynccontextmanager
    from pathlib import Path
    from typing import Any

    from starlette.middleware import Middleware
    from starlette.requests import Request
    from starlette.responses import JSONResponse
    from starlette.routing import Mount, Route
    from starlette.types import Receive, Scope, Send
    from starlette.websockets import WebSocket

    # NOTE: st.App is a module-level re-export, so we must import streamlit as
    # st here rather than only importing App from streamlit.starlette.
    import streamlit as st
    from streamlit.starlette import App

    class QuotaExceeded(Exception):
        """Typed exception used by a user exception handler."""

    class HeaderMiddleware:
        def __init__(self, app: object) -> None: ...

        async def __call__(
            self, scope: object, receive: object, send: object
        ) -> None: ...

    async def health(request: Request) -> JSONResponse: ...

    async def handle_quota(request: Request, exc: QuotaExceeded) -> JSONResponse: ...

    def handle_quota_sync(request: Request, exc: QuotaExceeded) -> JSONResponse: ...

    async def handle_any_exception(
        request: Request, exc: Exception
    ) -> JSONResponse: ...

    async def handle_websocket(websocket: WebSocket, exc: Exception) -> None: ...

    def suppress_error(exc: Exception) -> bool: ...

    def show_error(exc: Exception) -> None: ...

    def maybe_suppress_error(exc: Exception) -> bool | None: ...

    def main() -> None:
        pass

    @asynccontextmanager
    async def lifespan_with_state(app: App) -> AsyncIterator[dict[str, Any]]:
        yield {"ready": True}

    @asynccontextmanager
    async def lifespan_none(app: App) -> AsyncIterator[None]:
        yield None

    # =====================================================================
    # script_path
    # =====================================================================

    assert_type(App("main.py"), App)
    assert_type(App(Path("main.py")), App)
    assert_type(App(main), App)
    assert_type(st.App("main.py"), App)
    assert_type(st.App(main), App)

    # =====================================================================
    # secrets
    # =====================================================================

    assert_type(App("main.py", secrets=None), App)
    assert_type(App("main.py", secrets={"api_key": "secret"}), App)
    assert_type(App("main.py", secrets={"port": 5432}), App)
    assert_type(App("main.py", secrets={"ratio": 1.5}), App)
    assert_type(App("main.py", secrets={"enabled": True}), App)
    assert_type(App("main.py", secrets={"tags": ["a", "b"]}), App)
    assert_type(
        App("main.py", secrets={"db": {"host": "localhost", "port": 5432}}),
        App,
    )

    # =====================================================================
    # lifespan
    # =====================================================================

    assert_type(App("main.py", lifespan=None), App)
    assert_type(App("main.py", lifespan=lifespan_with_state), App)
    assert_type(App("main.py", lifespan=lifespan_none), App)

    # =====================================================================
    # routes
    # =====================================================================

    assert_type(App("main.py", routes=None), App)
    assert_type(App("main.py", routes=[]), App)
    assert_type(App("main.py", routes=[Route("/health", health)]), App)
    assert_type(
        App(
            "main.py", routes=[Route("/health", health), Mount("/static", App("x.py"))]
        ),
        App,
    )

    # =====================================================================
    # middleware
    # =====================================================================

    assert_type(App("main.py", middleware=None), App)
    assert_type(App("main.py", middleware=[]), App)
    assert_type(App("main.py", middleware=[Middleware(HeaderMiddleware)]), App)

    # =====================================================================
    # on_script_error
    # =====================================================================

    assert_type(App("main.py", on_script_error=None), App)
    assert_type(App("main.py", on_script_error=suppress_error), App)
    assert_type(App("main.py", on_script_error=show_error), App)
    assert_type(App("main.py", on_script_error=maybe_suppress_error), App)

    # =====================================================================
    # exception_handlers: subclass-typed exc must be accepted (see starlette_app.py).
    # =====================================================================

    assert_type(App("main.py", exception_handlers=None), App)
    assert_type(
        App("main.py", exception_handlers={QuotaExceeded: handle_quota}),
        App,
    )
    assert_type(
        App("main.py", exception_handlers={QuotaExceeded: handle_quota_sync}),
        App,
    )
    assert_type(
        App("main.py", exception_handlers={Exception: handle_any_exception}),
        App,
    )
    assert_type(App("main.py", exception_handlers={429: handle_any_exception}), App)
    assert_type(
        App("main.py", exception_handlers={Exception: handle_websocket}),
        App,
    )

    # =====================================================================
    # debug
    # =====================================================================

    assert_type(App("main.py", debug=True), App)
    assert_type(App("main.py", debug=False), App)

    # =====================================================================
    # All constructor parameters combined
    # =====================================================================

    assert_type(
        App(
            Path("main.py"),
            secrets={"api_key": "secret", "db": {"host": "localhost"}},
            lifespan=lifespan_with_state,
            routes=[Route("/health", health)],
            middleware=[Middleware(HeaderMiddleware)],
            on_script_error=suppress_error,
            exception_handlers={QuotaExceeded: handle_quota},
            debug=True,
        ),
        App,
    )

    # =====================================================================
    # Public properties and methods
    # =====================================================================

    app = App("main.py")
    assert_type(app.script_path, Path)
    assert_type(app.state, dict[str, Any])
    assert_type(app.run(), None)
    assert_type(app.run(config=None), None)
    assert_type(app.run(config={"server.port": 8502}), None)
    assert_type(
        app.lifespan(),
        Callable[[Any], AbstractAsyncContextManager[None]],
    )

    async def asgi(scope: Scope, receive: Receive, send: Send) -> None:
        await app(scope, receive, send)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # script_path is required
    App()  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    # script_path must be str, Path, or Callable[[], None]
    App(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    App(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Remaining constructor parameters are keyword-only
    App("main.py", None)  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # secrets must be a mapping of supported value types
    App("main.py", secrets="not-a-mapping")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    App("main.py", secrets={1: "x"})  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]
    App("main.py", secrets={"x": None})  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]

    # lifespan must be an async context manager factory
    App("main.py", lifespan="startup")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def not_a_lifespan(app: App) -> dict[str, Any]:
        return {}

    App("main.py", lifespan=not_a_lifespan)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # routes must be a sequence of BaseRoute
    App("main.py", routes="/health")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    App("main.py", routes=["/health"])  # type: ignore[list-item]  # ty: ignore[invalid-argument-type]

    # middleware must be a sequence of Middleware
    App("main.py", middleware=HeaderMiddleware)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    App("main.py", middleware=[HeaderMiddleware])  # type: ignore[list-item]  # ty: ignore[invalid-argument-type]

    # on_script_error must be Callable[[Exception], bool | None]
    App("main.py", on_script_error="sentry")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    def bad_error_handler(exc: Exception) -> str:
        return "no"

    App("main.py", on_script_error=bad_error_handler)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # exception_handlers values must be two-argument callables
    App(
        "main.py",
        exception_handlers={ValueError: "not a handler"},  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]
    )

    def wrong_arity_handler(exc: Exception) -> JSONResponse: ...

    App(
        "main.py",
        exception_handlers={ValueError: wrong_arity_handler},  # type: ignore[dict-item]  # ty: ignore[invalid-argument-type]
    )

    # debug must be bool
    App("main.py", debug=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    App("main.py", debug="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # run() config is keyword-only and must be a mapping
    app.run("server.port")  # type: ignore[call-arg, arg-type]  # ty: ignore[too-many-positional-arguments]
    app.run(config=["server.port"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
