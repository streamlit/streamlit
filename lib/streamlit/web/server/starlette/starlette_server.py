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

"""Uvicorn server for running the Starlette application."""

from __future__ import annotations

import errno
import socket
import sys
from typing import TYPE_CHECKING, Final

from streamlit import config
from streamlit.config_option import ConfigOption
from streamlit.logger import get_logger
from streamlit.runtime.runtime_util import get_max_message_size_bytes
from streamlit.web.server.starlette.starlette_app import create_starlette_app

if TYPE_CHECKING:
    from streamlit.runtime import Runtime

_LOGGER: Final = get_logger(__name__)

# When server.port is not available it will look for the next available port
# up to this number of retries.
_MAX_PORT_SEARCH_RETRIES: Final = 100


class RetriesExceededError(Exception):
    """Raised when the server cannot find an available port after max retries."""

    pass


def _server_port_is_manually_set() -> bool:
    """Check if the server port was explicitly configured by the user."""
    return config.is_manually_set("server.port")


def _server_address_is_unix_socket() -> bool:
    """Check if the server address is configured as a Unix socket."""
    address = config.get_option("server.address")
    return address is not None and address.startswith("unix://")


def _get_websocket_settings() -> tuple[int, int]:
    """Get the WebSocket ping interval and timeout settings.

    Returns a tuple of (ping_interval, ping_timeout) in seconds.
    Uvicorn/websockets doesn't have the same constraints as Tornado 6.5+,
    so we use simpler defaults.
    """
    configured_interval = config.get_option("server.websocketPingInterval")

    if configured_interval is not None:
        interval = int(configured_interval)
        # For uvicorn, we set timeout equal to interval for consistency
        return interval, interval

    # Default: 30 second interval, 30 second timeout
    return 30, 30


def _bind_socket(address: str, port: int, backlog: int) -> socket.socket:
    """Bind a non-blocking TCP socket to the given address and port.

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
    sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)

    if family == socket.AF_INET6:
        # Allow both IPv4 and IPv6 clients when binding to "::".
        sock.setsockopt(socket.IPPROTO_IPV6, socket.IPV6_V6ONLY, 0)

    sock.bind((address, port))
    sock.listen(backlog)
    sock.setblocking(False)
    sock.set_inheritable(True)
    return sock


async def start_starlette_server(runtime: Runtime) -> None:
    """Start a Starlette server with uvicorn.

    This function creates a Starlette application and runs it using uvicorn.
    It handles port binding with automatic retry on port conflicts.

    Parameters
    ----------
    runtime
        The Streamlit runtime instance to use for the server.

    Raises
    ------
    RuntimeError
        If uvicorn is not installed or Unix sockets are requested.
    RetriesExceededError
        If no available port can be found after max retries.
    """
    try:
        import uvicorn
    except ModuleNotFoundError as exc:  # pragma: no cover
        raise RuntimeError(
            "uvicorn is required for server.useStarlette but is not installed. "
            "Install it via `pip install streamlit[starlette]`."
        ) from exc

    if _server_address_is_unix_socket():
        raise RuntimeError("Unix sockets are not supported with Starlette currently.")

    app = create_starlette_app(runtime)

    configured_address = config.get_option("server.address")
    configured_port = int(config.get_option("server.port"))

    cert_file = config.get_option("server.sslCertFile")
    key_file = config.get_option("server.sslKeyFile")
    ws_ping_interval, ws_ping_timeout = _get_websocket_settings()
    ws_max_size = get_max_message_size_bytes()
    ws_per_message_deflate = config.get_option("server.enableWebsocketCompression")

    last_exception: BaseException | None = None

    for attempt in range(_MAX_PORT_SEARCH_RETRIES + 1):
        port = configured_port + attempt
        address = configured_address if configured_address else "127.0.0.1"

        uvicorn_config = uvicorn.Config(
            app,
            host=address,
            port=port,
            ssl_certfile=cert_file,
            ssl_keyfile=key_file,
            ws="auto",
            ws_ping_interval=ws_ping_interval,
            ws_ping_timeout=ws_ping_timeout,
            ws_max_size=ws_max_size,
            ws_per_message_deflate=ws_per_message_deflate,
            use_colors=False,
            log_config=None,
        )

        try:
            sock = _bind_socket(address, port, uvicorn_config.backlog)
        except OSError as exc:
            last_exception = exc
            if exc.errno == errno.EADDRINUSE:
                if _server_port_is_manually_set():
                    _LOGGER.error("Port %s is already in use", port)  # noqa: TRY400
                    sys.exit(1)
                _LOGGER.debug(
                    "Port %s already in use, trying to use the next one.", port
                )
                if attempt == _MAX_PORT_SEARCH_RETRIES:
                    raise RetriesExceededError(
                        f"Cannot start Streamlit server. Port {port} is already in use, "
                        f"and Streamlit was unable to find a free port after "
                        f"{_MAX_PORT_SEARCH_RETRIES} attempts."
                    ) from exc
                continue
            raise

        server = uvicorn.Server(uvicorn_config)
        _LOGGER.info("Starting Starlette server on %s:%s", address, port)

        try:
            config.set_option("server.port", port, ConfigOption.STREAMLIT_DEFINITION)
            await server.serve(sockets=[sock])
            return
        except Exception as e:  # pragma: no cover
            last_exception = e
            _LOGGER.exception("Error starting Starlette server")
            raise
        finally:
            sock.close()

    if last_exception is not None:
        raise last_exception
