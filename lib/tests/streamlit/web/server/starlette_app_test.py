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
import json
from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from starlette.testclient import TestClient

from streamlit import file_util
from streamlit.runtime.media_file_manager import MediaFileManager, MediaFileMetadata
from streamlit.runtime.media_file_storage import MediaFileKind
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.stats import CacheStat
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.web.server.starlette_app import create_starlette_app
from streamlit.web.server.stats_request_handler import StatsRequestHandler
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


class _DummyStatsManager:
    def __init__(self) -> None:
        self._stats = [CacheStat("test", "", 1)]

    def get_stats(self) -> list[CacheStat]:
        return self._stats


class _DummyComponentRegistry:
    def __init__(self) -> None:
        self._paths: dict[str, str] = {}

    def register(self, name: str, path: str) -> None:
        self._paths[name] = path

    def get_component_path(self, name: str) -> str | None:
        return self._paths.get(name)


class _DummyRuntime:
    def __init__(self, component_dir: Path) -> None:
        self.media_file_mgr = MediaFileManager(MemoryMediaFileStorage("/media"))
        self.uploaded_file_mgr = MemoryUploadedFileManager("/_stcore/upload_file")
        self.component_registry = _DummyComponentRegistry()
        self.component_registry.register("comp", str(component_dir))
        self.stats_mgr = _DummyStatsManager()
        self._active_sessions: set[str] = {"session123"}
        self.stopped = False
        self.last_backmsg = None
        self.last_user_info: dict[str, str | bool | None] | None = None
        self.last_existing_session_id: str | None = None

    @property
    def is_ready_for_browser_connection(self) -> asyncio.Future[tuple[bool, str]]:
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[tuple[bool, str]] = loop.create_future()
        fut.set_result((True, "ok"))
        return fut

    def is_active_session(self, session_id: str) -> bool:
        return session_id in self._active_sessions

    def connect_session(
        self,
        client: object,
        user_info: dict[str, str | bool | None],
        existing_session_id: str | None = None,
        session_id_override: str | None = None,
    ) -> str:
        session_id = existing_session_id or session_id_override or "session-new"
        self._active_sessions.add(session_id)
        self.last_user_info = dict(user_info)
        self.last_existing_session_id = existing_session_id
        return session_id

    def disconnect_session(self, session_id: str) -> None:
        self._active_sessions.discard(session_id)

    def handle_backmsg(self, session_id: str, msg: object) -> None:
        self.last_backmsg = (session_id, msg)

    def handle_backmsg_deserialization_exception(
        self, session_id: str, exc: BaseException
    ) -> None:
        self.last_backmsg = (session_id, exc)

    async def start(self) -> None:  # pragma: no cover - lifecycle stub
        return None

    def stop(self) -> None:  # pragma: no cover - lifecycle stub
        self.stopped = True


@pytest.fixture
def starlette_client(tmp_path: Path) -> Iterator[tuple[TestClient, _DummyRuntime]]:
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    with patch_config_options(
        {"server.baseUrlPath": "", "global.developmentMode": False}
    ):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

        runtime = _DummyRuntime(component_dir)
        app = create_starlette_app(runtime)
        with TestClient(app) as client:
            yield client, runtime

        monkeypatch.undo()


def test_health_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    client, _ = starlette_client
    response = client.get("/_stcore/health")
    assert response.status_code == 200
    assert response.text == "ok"


def test_metrics_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    client, _ = starlette_client
    response = client.get("/_stcore/metrics")
    assert response.status_code == 200
    assert "cache_memory_bytes" in response.text


def test_metrics_endpoint_protobuf(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    client, runtime = starlette_client
    expected = runtime.stats_mgr.get_stats()
    response = client.get(
        "/_stcore/metrics",
        headers={"Accept": "application/x-protobuf"},
    )
    assert response.status_code == 200
    assert response.headers["content-type"] == "application/x-protobuf"
    expected_proto = StatsRequestHandler._stats_to_proto(expected).SerializeToString()
    assert response.content == expected_proto


def test_media_endpoint_serves_file(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"data", "text/plain", MediaFileKind.MEDIA, "foo.txt"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url)
    assert response.status_code == 200
    assert response.content == b"data"


def test_media_endpoint_download_headers(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"binary",
        "application/octet-stream",
        MediaFileKind.DOWNLOADABLE,
        "fancy name.bin",
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.DOWNLOADABLE
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url)
    assert response.status_code == 200
    assert (
        response.headers["Content-Disposition"]
        == 'attachment; filename="fancy name.bin"'
    )


def test_upload_put_adds_file(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    client, runtime = starlette_client
    response = client.put(
        "_stcore/upload_file/session123/fileid",
        files={"file": ("foo.txt", b"payload", "text/plain")},
    )
    assert response.status_code == 204
    stored = runtime.uploaded_file_mgr.file_storage["session123"]["fileid"]
    assert stored.data == b"payload"


def test_component_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    client, _ = starlette_client
    response = client.get("/component/comp/index.html")
    assert response.status_code == 200
    assert response.text == "component"


def test_upload_delete_removes_file(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    client, runtime = starlette_client
    runtime.uploaded_file_mgr.file_storage.setdefault("session123", {})["fileid"] = (
        UploadedFileRec(
            file_id="fileid",
            name="foo.txt",
            type="text/plain",
            data=b"payload",
        )
    )

    response = client.delete("/_stcore/upload_file/session123/fileid")
    assert response.status_code == 204
    assert "fileid" not in runtime.uploaded_file_mgr.file_storage["session123"]


@patch_config_options({"global.developmentMode": False})
def test_host_config_excludes_localhost_when_not_dev(tmp_path: Path) -> None:
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    response = client.get("/_stcore/host-config")
    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert "http://localhost" not in body["allowedOrigins"]


@patch_config_options({"global.developmentMode": True})
def test_host_config_includes_localhost_in_dev(tmp_path: Path) -> None:
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    response = client.get("/_stcore/host-config")
    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert "http://localhost" in body["allowedOrigins"]


@patch_config_options({"global.developmentMode": True})
def test_static_files_skipped_in_dev_mode(tmp_path: Path) -> None:
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    # Static mount should be absent; Starlette returns 404 for root request.
    response = client.get("/")
    assert response.status_code == HTTPStatus.NOT_FOUND


@patch_config_options(
    {
        "server.enableXsrfProtection": True,
        "global.developmentMode": False,
        "server.cookieSecret": "test-signing-secret",
    }
)
def test_websocket_auth_cookie_yields_user_info(tmp_path: Path) -> None:
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    cookie_payload = json.dumps(
        {
            "origin": "http://testserver",
            "is_logged_in": True,
            "email": "user@example.com",
        }
    )
    from tornado.web import create_signed_value

    cookie_value = create_signed_value(
        "test-signing-secret",
        "_streamlit_user",
        cookie_payload,
    )

    client.cookies.set("_streamlit_user", cookie_value.decode("utf-8"))

    with client.websocket_connect(
        "/_stcore/stream",
        headers={"Origin": "http://testserver"},
    ) as websocket:
        websocket.close(code=1000)

    assert runtime.last_user_info is not None
    assert runtime.last_user_info.get("is_logged_in") is True
    assert runtime.last_user_info.get("email") == "user@example.com"


@patch_config_options({"server.enableXsrfProtection": False})
def test_websocket_accepts_existing_session(tmp_path: Path) -> None:
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    runtime = _DummyRuntime(component_dir)
    runtime._active_sessions.add("existing-456")
    app = create_starlette_app(runtime)
    client = TestClient(app)

    with client.websocket_connect(
        "_stcore/stream", subprotocols=["streamlit", "unused", "existing-456"]
    ) as websocket:
        websocket.close(code=1000)

    assert runtime.last_existing_session_id == "existing-456"
