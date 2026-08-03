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

"""Uvicorn server wrappers for running Streamlit applications (using Starlette).

This module provides two classes for running Streamlit apps with uvicorn:

1. **UvicornServer** (async): For embedding in an existing event loop.
   Used by the `Server` class for running Streamlit apps.

2. **UvicornRunner** (sync): For standalone CLI usage with blocking execution.
   Used by `run_asgi_app()` when running `st.App` via `streamlit run`.

Why Two Classes?
----------------
These classes serve different architectural needs:

- **UvicornServer** integrates with Streamlit's existing `Server` class architecture,
  which manages an event loop and coordinates multiple components (runtime, server,
  signal handlers). It uses `uvicorn.Server` with manual socket binding for fine-grained
  control and runs as a background task.

- **UvicornRunner** is designed for `st.App` mode where the app handles its own
  runtime lifecycle via ASGI lifespan. It uses `uvicorn.Server.run()` with a
  pre-bound socket, giving Streamlit the same bind behavior and port retry
  control as the managed server path.
"""

from __future__ import annotations

import asyncio
import errno
import socket
import sys
from typing import TYPE_CHECKING, Any, Final

from streamlit import config
from streamlit.config_option import ConfigOption
from streamlit.logger import get_logger
from streamlit.runtime.runtime_util import get_max_message_size_bytes
from streamlit.type_util import is_version_less_than
from streamlit.web.server.starlette.starlette_app import create_starlette_app
from streamlit.web.server.starlette.starlette_server_config import (
    DEFAULT_SERVER_ADDRESS,
    DEFAULT_WEBSOCKET_PING_INTERVAL,
    DEFAULT_WEBSOCKET_PING_TIMEOUT,
    MAX_PORT_SEARCH_RETRIES,
)

if TYPE_CHECKING:
    import uvicorn
    from starlette.types import ASGIApp

    from streamlit.runtime import Runtime

_LOGGER: Final = get_logger(__name__)


class RetriesExceededError(Exception):
    """Raised when the server cannot find an available port after max retries."""


# ---------------------------------------------------------------------------
# Private utility functions for uvicorn configuration
# ---------------------------------------------------------------------------


def _get_server_address() -> str:
    """Get the server address from config, with default fallback."""
    return config.get_option("server.address") or DEFAULT_SERVER_ADDRESS


def _get_bind_address(server_address: str) -> str:
    """Resolve the socket bind address for the configured server address.

    When the address is the implicit default (0.0.0.0, not set by the user),
    bind the IPv6 dual-stack wildcard "::" so the advertised localhost URL works
    on systems where localhost resolves to ::1 before 127.0.0.1. Fall back to the
    original address on systems without IPv6 support.
    """
    if (
        server_address == DEFAULT_SERVER_ADDRESS
        and not config.is_manually_set("server.address")
        and socket.has_ipv6
    ):
        return "::"
    return server_address


def _get_server_port() -> int:
    """Get the server port from config."""
    return int(config.get_option("server.port"))


def _is_port_manually_set() -> bool:
    """Check if the server port was explicitly configured by the user."""
    return config.is_manually_set("server.port")


def _server_address_is_unix_socket() -> bool:
    """Check if the server address is configured as a Unix socket."""
    address = config.get_option("server.address")
    return address is not None and address.startswith("unix://")


# Errnos that indicate the IPv6 dual-stack wildcard bind is not supported, so we
# should fall back to the original IPv4 address. EINVAL is included because some
# platforms report it (rather than EAFNOSUPPORT) when dual-stack sockets are
# disabled or unavailable. The fallback only triggers when we actually attempted
# the "::" bind, so a misclassified EINVAL at worst skips the IPv6 upgrade.
_IPV6_UNAVAILABLE_ERRNOS: Final[set[int]] = {
    err
    for err in (
        getattr(errno, "EADDRNOTAVAIL", None),
        getattr(errno, "EAFNOSUPPORT", None),
        getattr(errno, "EPROTONOSUPPORT", None),
        getattr(errno, "ENOPROTOOPT", None),
        getattr(errno, "EINVAL", None),
    )
    if err is not None
}
# Distinct exit code used when uvicorn returns without ever starting, so this
# failure mode is distinguishable from the generic sys.exit(1) used elsewhere.
_UVICORN_STARTUP_FAILURE_EXIT_CODE: Final = 3


def _bind_server_socket(
    server_address: str, bind_address: str, port: int, backlog: int
) -> tuple[socket.socket, str]:
    """Bind ``bind_address``, falling back to ``server_address`` on IPv6 errors.

    ``bind_address`` may be the IPv6 dual-stack wildcard chosen by
    _get_bind_address(). If binding it fails because IPv6 is unavailable, retry
    with the original ``server_address``.
    """
    try:
        return _bind_socket(bind_address, port, backlog), bind_address
    except OSError as exc:
        if bind_address != server_address and exc.errno in _IPV6_UNAVAILABLE_ERRNOS:
            _LOGGER.warning(
                "Could not bind IPv6 wildcard address %s:%s; falling back to %s:%s.",
                bind_address,
                port,
                server_address,
                port,
            )
            return _bind_socket(server_address, port, backlog), server_address
        raise


def _validate_ssl_config() -> tuple[str | None, str | None]:
    """Validate and return SSL configuration.

    Returns a tuple of (cert_file, key_file). Both are None if SSL is disabled,
    or both are set if SSL is enabled. Exits if only one is set.
    """
    cert_file = config.get_option("server.sslCertFile")
    key_file = config.get_option("server.sslKeyFile")

    # Validate SSL options: both must be set together or neither
    if bool(cert_file) != bool(key_file):
        _LOGGER.error(
            "Options 'server.sslCertFile' and 'server.sslKeyFile' must "
            "be set together. Set missing options or delete existing options."
        )
        sys.exit(1)

    return cert_file, key_file


def _get_websocket_settings() -> tuple[int, int]:
    """Get the WebSocket ping interval and timeout settings.

    Returns a tuple of (ping_interval, ping_timeout) in seconds.
    """
    configured_interval = config.get_option("server.websocketPingInterval")

    if configured_interval is not None:
        interval = int(configured_interval)
        # For uvicorn, we set timeout equal to interval for consistency
        return interval, interval

    return DEFAULT_WEBSOCKET_PING_INTERVAL, DEFAULT_WEBSOCKET_PING_TIMEOUT


def _get_websocket_protocol() -> str:
    """Get the WebSocket protocol to use based on uvicorn version.

    Returns "websockets-sansio" for uvicorn >= 0.44.0, otherwise "auto".
    "websockets-sansio" is the newer implementation that provides a cleaner
    separation between I/O and protocol logic. "auto" chooses the legacy
    websockets implementation. Full ping interval/timeout support was added
    in uvicorn 0.44.0.
    """
    import uvicorn

    if is_version_less_than(uvicorn.__version__, "0.44.0"):
        return "auto"
    return "websockets-sansio"


def _get_uvicorn_config_kwargs() -> dict[str, Any]:
    """Get common uvicorn configuration kwargs.

    Returns a dict of kwargs that can be passed to uvicorn.Config.
    Does NOT include app, host, or port - those must be provided separately.
    """
    cert_file, key_file = _validate_ssl_config()
    ws_ping_interval, ws_ping_timeout = _get_websocket_settings()
    ws_max_size = get_max_message_size_bytes()
    ws_per_message_deflate = config.get_option("server.enableWebsocketCompression")

    return {
        "ssl_certfile": cert_file,
        "ssl_keyfile": key_file,
        "ws": _get_websocket_protocol(),
        "ws_ping_interval": ws_ping_interval,
        "ws_ping_timeout": ws_ping_timeout,
        "ws_max_size": ws_max_size,
        "ws_per_message_deflate": ws_per_message_deflate,
        "use_colors": False,
        # Don't override uvicorn's default logging config to ensure logs appear.
        # Disable access logs to reduce noise (error logs will still appear).
        "access_log": False,
    }


def _bind_socket(address: str, port: int, backlog: int) -> socket.socket:
    """Bind a non-blocking TCP socket to the given address and port.

    We pre-bind the socket ourselves (rather than letting uvicorn do it) to:

    1. Detect port conflicts before creating the uvicorn.Server instance
    2. Enable port retry logic when the configured port is already in use
    3. Have explicit control over socket options (SO_REUSEADDR, IPV6_V6ONLY)

    Parameters
    ----------
    address
        The IP address to bind to (e.g., "127.0.0.1" or "::").

    port
        The port number to bind to.

    backlog
        The maximum number of queued connections.

    Returns
    -------
    socket.socket
        A bound, listening, non-blocking socket.
    """
    if ":" in address:
        family = socket.AF_INET6
    else:
        family = socket.AF_INET

    sock = socket.socket(family=family)
    try:
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

        if family == socket.AF_INET6:
            # Allow both IPv4 and IPv6 clients when binding to "::".
            sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)

        sock.bind((address, port))
        sock.listen(backlog)
        sock.setblocking(False)
        sock.set_inheritable(True)
        return sock
    except BaseException:
        sock.close()
        raise


# ---------------------------------------------------------------------------
# Server classes
# ---------------------------------------------------------------------------


class UvicornServer:
    """Async uvicorn server for embedding in an existing event loop.

    This class is used by Streamlit's `Server` class for running Streamlit apps.
    It wraps `uvicorn.Server` and provides:

    - `start()`: Async method that returns when the server is ready to accept connections
    - Background task execution: Server runs in background while caller continues
    - `stop()`: Gracefully signal the server to shut down
    - `stopped`: Event that fires when the server has fully stopped

    This async design allows the `Server` class to coordinate multiple components
    (runtime lifecycle, signal handlers, stop/stopped semantics) in its event loop.

    Parameters
    ----------
    runtime
        The Streamlit Runtime instance. Used to create the Starlette application
        via `create_starlette_app(runtime)`.

    Examples
    --------
    Used internally by Server.start():

    >>> server = UvicornServer(runtime)
    >>> await server.start()  # Returns when ready
    >>> # ... server running in background ...
    >>> server.stop()
    >>> await server.stopped.wait()
    """

    def __init__(self, runtime: Runtime) -> None:
        self._runtime = runtime
        self._server: uvicorn.Server | None = None
        self._server_task: asyncio.Task[None] | None = None
        self._stopped_event = asyncio.Event()
        self._socket: socket.socket | None = None

    async def start(self) -> None:
        """Start the server and return when ready to accept connections."""
        try:
            import uvicorn
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise RuntimeError(
                "uvicorn is not installed. Please reinstall Streamlit."
            ) from exc

        if _server_address_is_unix_socket():
            raise RuntimeError(
                "Unix sockets are not supported with Starlette currently."
            )

        app = create_starlette_app(self._runtime)

        # Get server configuration
        configured_address = _get_server_address()
        bind_address = _get_bind_address(configured_address)
        configured_port = _get_server_port()
        uvicorn_kwargs = _get_uvicorn_config_kwargs()

        last_exception: BaseException | None = None

        for attempt in range(MAX_PORT_SEARCH_RETRIES + 1):
            port = configured_port + attempt

            uvicorn_config = uvicorn.Config(
                app,
                host=bind_address,
                port=port,
                **uvicorn_kwargs,
            )

            try:
                self._socket, actual_bind_address = _bind_server_socket(
                    configured_address,
                    bind_address,
                    port,
                    uvicorn_config.backlog,
                )
                if actual_bind_address != bind_address:
                    bind_address = actual_bind_address
                    uvicorn_config.host = actual_bind_address
            except OSError as exc:
                last_exception = exc
                # EADDRINUSE: port in use by another process
                # EACCES: port reserved by system (common on Windows, see #13521)
                if exc.errno in {errno.EADDRINUSE, errno.EACCES}:
                    if _is_port_manually_set():
                        _LOGGER.error("Port %s is not available", port)  # noqa: TRY400
                        sys.exit(1)
                    _LOGGER.debug(
                        "Port %s not available, trying to use the next one.", port
                    )
                    if attempt == MAX_PORT_SEARCH_RETRIES:
                        raise RetriesExceededError(
                            f"Cannot start Streamlit server. Port {port} is not available, "
                            f"and Streamlit was unable to find a free port after "
                            f"{MAX_PORT_SEARCH_RETRIES} attempts."
                        ) from exc
                    continue
                raise

            # Port 0 means the OS assigns an ephemeral port. Read it back
            # so that config and displayed URLs reflect the real port.
            if port == 0:
                port = self._socket.getsockname()[1]
                uvicorn_config.port = port

            self._server = uvicorn.Server(uvicorn_config)
            config.set_option("server.port", port, ConfigOption.STREAMLIT_DEFINITION)
            _LOGGER.debug(
                "Starting uvicorn server on %s:%s",
                bind_address,
                port,
            )

            startup_complete = asyncio.Event()
            startup_exception: BaseException | None = None

            async def serve_with_signal() -> None:
                """Serve the application with proper lifecycle management.

                This ensures the server is shut down gracefully when the task is
                cancelled or an exception occurs.
                """
                nonlocal startup_exception
                if self._server is None or self._socket is None:
                    raise RuntimeError("Server or socket not initialized")

                try:
                    # Initialize config and lifespan (normally done in _serve)
                    server_config = self._server.config
                    if not server_config.loaded:
                        server_config.load()
                    self._server.lifespan = server_config.lifespan_class(server_config)

                    await self._server.startup(sockets=[self._socket])
                    if self._server.should_exit:
                        startup_exception = RuntimeError("Server startup failed")
                        startup_complete.set()  # noqa: B023
                        return

                    startup_complete.set()  # noqa: B023

                    await self._server.main_loop()
                except BaseException as e:
                    # Catch BaseException to handle CancelledError (which is not
                    # an Exception). This ensures startup_complete is set even if
                    # the task is cancelled before startup completes, preventing
                    # a deadlock in start() which awaits startup_complete.
                    startup_exception = e
                    raise
                finally:
                    try:
                        if self._server is not None:
                            await self._server.shutdown(sockets=[self._socket])
                    finally:
                        # Ensure socket cleanup and stopped event are always set,
                        # even if shutdown raises an exception.
                        if self._socket is not None:
                            self._socket.close()
                            self._socket = None
                        self._stopped_event.set()
                        # Always set startup_complete to prevent deadlock in start()
                        # if task is cancelled before normal startup_complete.set().
                        startup_complete.set()  # noqa: B023

            self._server_task = asyncio.create_task(
                serve_with_signal(), name="uvicorn-server"
            )

            await startup_complete.wait()

            if startup_exception is not None:
                raise startup_exception

            _LOGGER.info(
                "Uvicorn server started on %s:%s",
                bind_address,
                port,
            )
            return

        if last_exception is not None:
            raise last_exception

    def stop(self) -> None:
        """Signal the server to stop."""
        if self._server is not None:
            self._server.should_exit = True

    @property
    def stopped(self) -> asyncio.Event:
        """An event that is set when the server has fully stopped."""
        return self._stopped_event


class UvicornRunner:
    """Sync uvicorn runner for standalone CLI usage.

    This class is used by `run_asgi_app()` when running `st.App` via `streamlit run`.
    It wraps `uvicorn.Server.run()` which is a blocking call that:

    - Creates and manages its own event loop
    - Handles OS signals (SIGINT, SIGTERM) for graceful shutdown
    - Runs until the server exits

    This is ideal for `st.App` mode because:

    - The `st.App` handles its own runtime lifecycle via ASGI lifespan hooks
    - No external coordination is needed - uvicorn manages everything
    - Simple "run and block" semantics for CLI usage

    Parameters
    ----------
    app
        Either an ASGI app instance or an import string (e.g., "myapp:app").
        Import strings are preferred as they allow uvicorn to handle the import.

    Examples
    --------
    Used by bootstrap.run_asgi_app():

    >>> runner = UvicornRunner("myapp:app")
    >>> runner.run()  # Blocks until server exits
    """

    def __init__(self, app: str | ASGIApp) -> None:
        self._app = app

    def run(self) -> None:
        """Run the server synchronously (blocking until exit).

        This method blocks until the server exits, either from a signal
        (Ctrl+C, SIGTERM) or an error. It handles port retry automatically
        if the configured port is not available.
        """
        try:
            import uvicorn
        except ModuleNotFoundError as exc:  # pragma: no cover
            raise RuntimeError(
                "uvicorn is required for running st.App. "
                "Install it with: pip install uvicorn"
            ) from exc

        # Imported lazily to avoid a circular import at module load time.
        from streamlit.web import bootstrap

        if _server_address_is_unix_socket():
            raise RuntimeError("Unix sockets are not supported with st.App currently.")

        # Get server configuration
        configured_address = _get_server_address()
        bind_address = _get_bind_address(configured_address)
        configured_port = _get_server_port()
        uvicorn_kwargs = _get_uvicorn_config_kwargs()

        # Port retry loop - try successive ports if the configured one is busy
        for attempt in range(MAX_PORT_SEARCH_RETRIES + 1):
            port = configured_port + attempt

            if attempt > 0:
                config.set_option(
                    "server.port", port, ConfigOption.STREAMLIT_DEFINITION
                )

            try:
                _LOGGER.debug(
                    "Starting uvicorn runner on %s:%s",
                    bind_address,
                    port,
                )
                uvicorn_config = uvicorn.Config(
                    self._app,
                    host=bind_address,
                    port=port,
                    **uvicorn_kwargs,
                )

                server_socket, actual_bind_address = _bind_server_socket(
                    configured_address,
                    bind_address,
                    port,
                    uvicorn_config.backlog,
                )
                try:
                    if actual_bind_address != bind_address:
                        bind_address = actual_bind_address
                        uvicorn_config.host = actual_bind_address

                    if port == 0:
                        port = server_socket.getsockname()[1]
                        uvicorn_config.port = port
                        config.set_option(
                            "server.port", port, ConfigOption.STREAMLIT_DEFINITION
                        )

                    # Print the app URL now that the final port is known.
                    bootstrap._print_url(is_running_hello=False)

                    server = uvicorn.Server(uvicorn_config)
                    server.run(sockets=[server_socket])
                finally:
                    server_socket.close()

                if not server.started:
                    sys.exit(_UVICORN_STARTUP_FAILURE_EXIT_CODE)
                return  # Server exited normally
            except OSError as exc:
                # EADDRINUSE: port in use by another process
                # EACCES: port reserved by system (common on Windows)
                if exc.errno in {errno.EADDRINUSE, errno.EACCES}:
                    if _is_port_manually_set():
                        _LOGGER.error("Port %s is not available", port)  # noqa: TRY400
                        sys.exit(1)
                    _LOGGER.debug(
                        "Port %s not available, trying to use the next one.", port
                    )
                    if attempt == MAX_PORT_SEARCH_RETRIES:
                        _LOGGER.error(  # noqa: TRY400
                            "Cannot start Streamlit server. Port %s is not available, "
                            "and Streamlit was unable to find a free port after "
                            "%s attempts.",
                            port,
                            MAX_PORT_SEARCH_RETRIES,
                        )
                        sys.exit(1)
                    continue
                raise
