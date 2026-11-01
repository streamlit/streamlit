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

"""A real Runtime behind the agent API routes, for the route tests."""

from __future__ import annotations

import textwrap
from contextlib import asynccontextmanager, contextmanager
from typing import TYPE_CHECKING, Any
from unittest.mock import patch

from starlette.applications import Starlette
from starlette.testclient import TestClient

from streamlit import file_util
from streamlit.elements.lib import agent_spec
from streamlit.runtime import Runtime, RuntimeConfig
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_session_storage import MemorySessionStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.web.server.starlette import starlette_agent_routes
from streamlit.web.server.starlette.starlette_routes import (
    create_app_static_serving_routes,
    create_media_routes,
)
from streamlit.web.server.starlette.starlette_static_routes import (
    create_streamlit_static_assets_routes,
)
from tests.streamlit.runtime.agent import run_gate
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Generator
    from pathlib import Path

    from starlette.routing import BaseRoute


@asynccontextmanager
async def _lifespan_with(runtime: Runtime) -> AsyncGenerator[None, None]:
    await runtime.start()
    try:
        yield
    finally:
        run_gate.opened.set()
        runtime.stop()
        await runtime.stopped


def _static_assets_routes(tmp_path: Path, base_url: str) -> list[BaseRoute]:
    """The core static files mount, serving a stand-in ``index.html``."""
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>app</html>")
    with patch.object(file_util, "get_static_dir", return_value=str(static_dir)):
        return create_streamlit_static_assets_routes(base_url)


@contextmanager
def served_app(
    tmp_path: Path,
    script: str,
    overrides: dict[str, Any],
    *,
    base_url: str = "",
    static_assets: bool = False,
) -> Generator[TestClient, None, None]:
    """A real Runtime on ``script``, behind the agent, media, and app static routes.

    ``overrides`` is read at every lookup, so a test can change an option while
    the app runs. With ``static_assets``, the core static files mount comes
    last, as in the real app, and answers every path no route takes.
    """
    main_script = tmp_path / "app.py"
    main_script.write_text(textwrap.dedent(script))
    media_storage = MemoryMediaFileStorage("/media")
    registered = agent_spec._agent_session_ids
    run_gate.reset()
    Runtime._instance = None
    defaults = {
        "server.enableAgentApi": True,
        "server.fileWatcherType": "none",
        "server.baseUrlPath": base_url,
        "server.agentWaitTimeout": 10,
    }
    for name, value in defaults.items():
        overrides.setdefault(name, value)
    try:
        with patch_config_options(overrides):
            runtime = Runtime(
                RuntimeConfig(
                    script_path=str(main_script),
                    media_file_storage=media_storage,
                    uploaded_file_manager=MemoryUploadedFileManager(
                        "/_stcore/upload_file"
                    ),
                    cache_storage_manager=MemoryCacheStorageManager(),
                    session_storage=MemorySessionStorage(),
                )
            )
            app = Starlette(
                routes=[
                    *starlette_agent_routes.create_agent_routes(runtime, base_url),
                    *create_media_routes(media_storage, base_url),
                    *create_app_static_serving_routes(str(main_script), base_url),
                    *(
                        _static_assets_routes(tmp_path, base_url)
                        if static_assets
                        else []
                    ),
                ],
                lifespan=lambda _app: _lifespan_with(runtime),
            )
            with TestClient(app) as client:
                yield client
    finally:
        run_gate.opened.set()
        Runtime._instance = None
        agent_spec._agent_session_ids = registered
