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

from typing import TYPE_CHECKING, Final

from streamlit import cli_util, config, util
from streamlit.logger import get_logger
from streamlit.runtime import Runtime, RuntimeConfig, RuntimeState
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_session_storage import MemorySessionStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.web.cache_storage_manager_config import (
    create_default_cache_storage_manager,
)

if TYPE_CHECKING:
    import asyncio
    from collections.abc import Awaitable

    from streamlit.web.server.starlette import UvicornServer

_LOGGER: Final = get_logger(__name__)

# When server.address starts with this prefix, the server will bind
# to a unix socket.
UNIX_SOCKET_PREFIX: Final = "unix://"

# Endpoint path constants used by tests and other modules to construct URLs.
MEDIA_ENDPOINT: Final = "/media"
UPLOAD_FILE_ENDPOINT: Final = "/_stcore/upload_file"


def server_address_is_unix_socket() -> bool:
    address = config.get_option("server.address")
    return address is not None and address.startswith(UNIX_SOCKET_PREFIX)


class Server:
    def __init__(self, main_script_path: str, is_hello: bool) -> None:
        """Create the server. It won't be started yet."""
        self._main_script_path = main_script_path
        self._starlette_server: UvicornServer | None = None

        # Prevent garbage collection of the bootstrap task while it's running.
        self._bootstrap_task: asyncio.Task[None] | None = None

        media_file_storage = MemoryMediaFileStorage(MEDIA_ENDPOINT)

        uploaded_file_mgr = MemoryUploadedFileManager(UPLOAD_FILE_ENDPOINT)

        self._runtime = Runtime(
            RuntimeConfig(
                script_path=main_script_path,
                media_file_storage=media_file_storage,
                uploaded_file_manager=uploaded_file_mgr,
                cache_storage_manager=create_default_cache_storage_manager(),
                is_hello=is_hello,
                session_storage=MemorySessionStorage(
                    ttl_seconds=config.get_option("server.disconnectedSessionTTL")
                ),
            ),
        )

    def __repr__(self) -> str:
        return util.repr_(self)

    @property
    def main_script_path(self) -> str:
        return self._main_script_path

    async def start(self) -> None:
        """Start the server.

        When this returns, Streamlit is ready to accept new sessions.
        """
        _LOGGER.debug("Starting server...")

        from streamlit.web.server.starlette import UvicornServer

        self._starlette_server = UvicornServer(self._runtime)
        await self._starlette_server.start()

    @property
    def stopped(self) -> Awaitable[None]:
        """A Future that completes when the Server's run loop has exited."""

        async def _wait_for_stop() -> None:
            if self._starlette_server is not None:
                await self._starlette_server.stopped.wait()
            # Also wait for the runtime to complete its shutdown
            # (session cleanup, etc.) to ensure graceful shutdown.
            await self._runtime.stopped

        return _wait_for_stop()

    @property
    def browser_is_connected(self) -> bool:
        return self._runtime.state == RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED

    @property
    def is_running_hello(self) -> bool:
        from streamlit.hello import streamlit_app

        return self._main_script_path == streamlit_app.__file__

    def stop(self) -> None:
        cli_util.print_to_cli("  Stopping...", fg="blue")
        if self._starlette_server is not None:
            # Starlette's lifespan handler calls runtime.stop() during shutdown
            self._starlette_server.stop()
        else:
            # Fallback: stop runtime directly if starlette_server not initialized
            self._runtime.stop()
