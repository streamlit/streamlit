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

import asyncio
import json
from http import HTTPStatus
from typing import TYPE_CHECKING

import pytest
from starlette.testclient import TestClient

from streamlit import file_util
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.runtime.media_file_manager import MediaFileManager, MediaFileMetadata
from streamlit.runtime.media_file_storage import MediaFileKind
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.stats import CacheStat, CounterStat, GaugeStat
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.web.server.routes import STATIC_ASSET_CACHE_MAX_AGE_SECONDS
from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_app import create_starlette_app
from streamlit.web.server.stats_request_handler import StatsRequestHandler
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Iterator
    from pathlib import Path


class _DummyStatsManager:
    def __init__(self) -> None:
        self._stats: dict[str, list[CacheStat | CounterStat | GaugeStat]] = {
            "cache_memory_bytes": [CacheStat("test_cache", "", 1)],
            "session_events_total": [
                CounterStat(
                    family_name="session_events_total",
                    value=5,
                    labels={"type": "connect"},
                    help="Total count of session events by type.",
                )
            ],
            "active_sessions": [
                GaugeStat(
                    family_name="active_sessions",
                    value=3,
                    help="Current number of active sessions.",
                )
            ],
        }

    def get_stats(
        self, family_names: list[str] | None = None
    ) -> dict[str, list[CacheStat | CounterStat | GaugeStat]]:
        if family_names is None:
            return self._stats
        return {k: self._stats.get(k, []) for k in family_names}


class _DummyComponentRegistry:
    def __init__(self) -> None:
        self._paths: dict[str, str] = {}

    def register(self, name: str, path: str) -> None:
        self._paths[name] = path

    def get_component_path(self, name: str) -> str | None:
        return self._paths.get(name)


class _DummyBidiComponentRegistry:
    def __init__(self) -> None:
        self._paths: dict[str, str] = {}

    def register(self, name: str, path: str) -> None:
        self._paths[name] = path

    def get(self, name: str) -> str | None:
        return self._paths.get(name)

    def get_component_path(self, name: str) -> str | None:
        return self._paths.get(name)


class _DummyRuntime:
    def __init__(self, component_dir: Path) -> None:
        self.media_file_mgr = MediaFileManager(MemoryMediaFileStorage("/media"))
        self.uploaded_file_mgr = MemoryUploadedFileManager("/_stcore/upload_file")
        self.component_registry = _DummyComponentRegistry()
        self.component_registry.register("comp", str(component_dir))
        self.bidi_component_registry = _DummyBidiComponentRegistry()
        self.bidi_component_registry.register("comp", str(component_dir))
        self.stats_mgr = _DummyStatsManager()
        self._active_sessions: set[str] = {"session123"}
        self.stopped = False
        self.last_backmsg = None
        self.last_user_info: dict[str, str | bool | None] | None = None
        self.last_existing_session_id: str | None = None
        self.script_health = (True, "ok")

    @property
    def is_ready_for_browser_connection(self) -> asyncio.Future[tuple[bool, str]]:
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[tuple[bool, str]] = loop.create_future()
        fut.set_result((True, "ok"))
        return fut

    def does_script_run_without_error(self) -> asyncio.Future[tuple[bool, str]]:
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[tuple[bool, str]] = loop.create_future()
        fut.set_result(self.script_health)
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
    (component_dir / "bundle.js").write_text("console.log('component');")

    with patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            # Disable XSRF for basic tests (matches Tornado test behavior)
            "server.enableXsrfProtection": False,
        }
    ):
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

        runtime = _DummyRuntime(component_dir)
        app = create_starlette_app(runtime)
        with TestClient(app) as client:
            yield client, runtime

        monkeypatch.undo()


def test_health_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    """Test that the health endpoint returns 200 with 'ok' message."""
    client, _ = starlette_client
    response = client.get("/_stcore/health")
    assert response.status_code == 200
    assert response.text == "ok"


def test_metrics_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    """Test that the metrics endpoint returns stats in text format."""
    client, _ = starlette_client
    response = client.get("/_stcore/metrics")
    assert response.status_code == 200
    assert "cache_memory_bytes" in response.text
    assert "session_events_total" in response.text
    assert "active_sessions" in response.text


def test_metrics_endpoint_filters_single_family(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that the metrics endpoint filters by a single family."""
    client, _ = starlette_client
    response = client.get("/_stcore/metrics?families=session_events_total")
    assert response.status_code == 200
    assert "session_events_total" in response.text
    assert "cache_memory_bytes" not in response.text
    assert "# TYPE active_sessions" not in response.text


def test_metrics_endpoint_filters_multiple_families(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that the metrics endpoint filters by multiple families."""
    client, _ = starlette_client
    response = client.get(
        "/_stcore/metrics?families=session_events_total&families=active_sessions"
    )
    assert response.status_code == 200
    assert "session_events_total" in response.text
    assert "active_sessions" in response.text
    assert "cache_memory_bytes" not in response.text


def test_metrics_endpoint_unknown_family_returns_eof(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that unknown family returns only EOF marker."""
    client, _ = starlette_client
    response = client.get("/_stcore/metrics?families=unknown_family")
    assert response.status_code == 200
    assert response.text.strip() == "# EOF"


def test_metrics_endpoint_protobuf(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that the metrics endpoint returns stats in protobuf format when requested."""
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
    """Test that the media endpoint serves files correctly."""
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
    """Test that downloadable files have Content-Disposition attachment header."""
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


def test_media_endpoint_supports_range_requests(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure the media endpoint serves byte ranges for streaming clients."""
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"abcdefghij", "video/mp4", MediaFileKind.MEDIA, "clip.mp4"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url, headers={"Range": "bytes=2-5"})

    assert response.status_code == HTTPStatus.PARTIAL_CONTENT
    assert response.content == b"cdef"
    assert response.headers["Content-Range"] == "bytes 2-5/10"
    assert response.headers["Accept-Ranges"] == "bytes"


def test_media_endpoint_rejects_invalid_ranges(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure the media endpoint rejects unsatisfiable range headers."""
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"abcd", "video/mp4", MediaFileKind.MEDIA, "clip.mp4"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url, headers={"Range": "bytes=50-60"})

    assert response.status_code == HTTPStatus.REQUESTED_RANGE_NOT_SATISFIABLE
    assert response.headers["Content-Range"] == "bytes */4"


def test_media_endpoint_supports_head_requests(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure the media endpoint supports HEAD requests for browser probing."""
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"abcdefghij", "video/mp4", MediaFileKind.MEDIA, "clip.mp4"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.head(media_url)

    assert response.status_code == 200
    assert response.headers["Content-Length"] == "10"
    assert response.headers["Accept-Ranges"] == "bytes"
    assert response.headers["Content-Type"] == "video/mp4"
    # HEAD requests should not return body
    assert response.content == b""


def test_media_endpoint_no_content_encoding_for_video(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure video files are not gzip-compressed."""
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"video-data", "video/mp4", MediaFileKind.MEDIA, "clip.mp4"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url)

    assert response.status_code == 200
    # Media routes use Content-Encoding: identity to prevent gzip compression.
    # Both None and "identity" indicate no encoding is applied.
    assert response.headers.get("Content-Encoding") in (None, "identity")


def test_media_endpoint_no_content_encoding_for_audio(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure audio files are not gzip-compressed."""
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"audio-data", "audio/mpeg", MediaFileKind.MEDIA, "sound.mp3"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url)

    assert response.status_code == 200
    # Media routes use Content-Encoding: identity to prevent gzip compression.
    # Both None and "identity" indicate no encoding is applied.
    assert response.headers.get("Content-Encoding") in (None, "identity")


def test_media_endpoint_no_content_encoding_for_range_requests(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure video range requests are not gzip-compressed."""
    client, runtime = starlette_client
    storage = runtime.media_file_mgr._storage
    file_id = storage.load_and_get_id(
        b"video-data-here", "video/mp4", MediaFileKind.MEDIA, "clip.mp4"
    )
    runtime.media_file_mgr._file_metadata[file_id] = MediaFileMetadata(
        MediaFileKind.MEDIA
    )

    media_url = storage.get_url(file_id)
    response = client.get(media_url, headers={"Range": "bytes=0-4"})

    assert response.status_code == HTTPStatus.PARTIAL_CONTENT
    # Range requests for media don't include Content-Encoding
    assert response.headers.get("Content-Encoding") in (None, "identity")


def test_upload_put_adds_file(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that file uploads are stored correctly."""
    client, runtime = starlette_client
    response = client.put(
        "_stcore/upload_file/session123/fileid",
        files={"file": ("foo.txt", b"payload", "text/plain")},
    )
    assert response.status_code == 204
    stored = runtime.uploaded_file_mgr.file_storage["session123"]["fileid"]
    assert stored.data == b"payload"


def test_upload_put_enforces_max_size(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that uploads exceeding server.maxUploadSize are rejected."""
    client, _ = starlette_client

    # Configure small max size (1MB)
    with patch_config_options({"server.maxUploadSize": 1}):
        # 1. Check Content-Length header rejection
        response = client.put(
            "_stcore/upload_file/session123/fileid",
            files={"file": ("foo.txt", b"x" * (1024 * 1024 + 100), "text/plain")},
            # TestClient automatically sets Content-Length
        )
        assert response.status_code == 413
        assert response.text == "File too large"


def test_component_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    """Test that custom component files are served correctly."""
    client, _ = starlette_client
    response = client.get("/component/comp/index.html")
    assert response.status_code == 200
    assert response.text == "component"


def test_component_endpoint_sets_content_type(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Ensure the component endpoint sends the correct MIME type for JS assets."""
    client, _ = starlette_client
    response = client.get("/component/comp/bundle.js")
    assert response.status_code == 200
    assert response.headers["content-type"] is not None
    assert "javascript" in response.headers["content-type"]


def test_bidi_component_endpoint(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test the bidirectional component endpoint."""
    client, _ = starlette_client
    response = client.get("/_stcore/bidi-components/comp/index.html")
    assert response.status_code == 200
    assert response.text == "component"


def test_script_health_endpoint(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test the script health check endpoint."""
    client, runtime = starlette_client

    # Default enabled
    with patch_config_options({"server.scriptHealthCheckEnabled": True}):
        # Re-create app to apply config change
        app = create_starlette_app(runtime)
        with TestClient(app) as client:
            response = client.get("/_stcore/script-health-check")
            assert response.status_code == 200
            assert response.text == "ok"

            # Simulate failure
            runtime.script_health = (False, "error")
            response = client.get("/_stcore/script-health-check")
            assert response.status_code == 503
            assert response.text == "error"


def test_websocket_rejects_text_frames(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that the WebSocket endpoint rejects text frames."""
    client, _ = starlette_client
    # Starlette's receive_bytes() raises KeyError when text frame is received
    # instead of binary, because the message dict contains "text" not "bytes".
    with pytest.raises(KeyError):
        with client.websocket_connect("/_stcore/stream") as websocket:
            # Sending a text frame should fail - endpoint expects binary protobufs
            websocket.send_text("Hello")
            websocket.receive_text()


def test_upload_delete_removes_file(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that file deletions remove files from storage."""
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


@patch_config_options(
    {"server.enableXsrfProtection": True, "global.developmentMode": False}
)
def test_upload_rejects_without_xsrf_token(tmp_path: Path) -> None:
    """Test that uploads are rejected without a valid XSRF token when protection is enabled."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    # PUT without XSRF token should fail
    response = client.put(
        "_stcore/upload_file/session123/fileid",
        files={"file": ("foo.txt", b"payload", "text/plain")},
    )
    assert response.status_code == 403
    assert "XSRF" in response.text

    # DELETE without XSRF token should fail
    response = client.delete("_stcore/upload_file/session123/fileid")
    assert response.status_code == 403
    assert "XSRF" in response.text

    monkeypatch.undo()


@patch_config_options(
    {"server.enableXsrfProtection": True, "global.developmentMode": False}
)
def test_upload_accepts_with_valid_xsrf_token(tmp_path: Path) -> None:
    """Test that uploads succeed with a valid XSRF token when protection is enabled."""
    from streamlit.web.server.starlette import starlette_app_utils

    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    # Generate a valid XSRF token
    xsrf_token = starlette_app_utils.generate_xsrf_token_string()
    client.cookies.set("_streamlit_xsrf", xsrf_token)

    # PUT with valid XSRF token should succeed
    response = client.put(
        "_stcore/upload_file/session123/fileid",
        files={"file": ("foo.txt", b"payload", "text/plain")},
        headers={"X-Xsrftoken": xsrf_token},
    )
    assert response.status_code == 204

    monkeypatch.undo()


@patch_config_options({"global.developmentMode": False})
def test_host_config_excludes_localhost_when_not_dev(tmp_path: Path) -> None:
    """Test that localhost is excluded from allowed origins in production mode."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    response = client.get("/_stcore/host-config")
    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert "http://localhost" not in body["allowedOrigins"]

    monkeypatch.undo()


@patch_config_options({"global.developmentMode": True})
def test_host_config_includes_localhost_in_dev(tmp_path: Path) -> None:
    """Test that localhost is included in allowed origins in development mode."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    response = client.get("/_stcore/host-config")
    assert response.status_code == HTTPStatus.OK
    body = response.json()
    assert "http://localhost" in body["allowedOrigins"]

    monkeypatch.undo()


@patch_config_options({"global.developmentMode": True})
def test_static_files_skipped_in_dev_mode(tmp_path: Path) -> None:
    """Test that static file serving is skipped in development mode."""
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
    """Test that auth cookies are properly parsed when valid XSRF token is provided."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    # Create auth cookie payload
    cookie_payload = json.dumps(
        {
            "origin": "http://testserver",
            "is_logged_in": True,
            "email": "user@example.com",
        }
    )
    cookie_value = starlette_app_utils.create_signed_value(
        "test-signing-secret",
        "_streamlit_user",
        cookie_payload,
    )

    # Generate a valid XSRF token (same token for cookie and subprotocol)
    xsrf_token = starlette_app_utils.generate_xsrf_token_string()

    # Set both cookies
    client.cookies.set("_streamlit_user", cookie_value.decode("utf-8"))
    client.cookies.set("_streamlit_xsrf", xsrf_token)

    # Connect with XSRF token in subprotocol (second position)
    with client.websocket_connect(
        "/_stcore/stream",
        headers={"Origin": "http://testserver"},
        subprotocols=["streamlit", xsrf_token],
    ) as websocket:
        websocket.close(code=1000)

    assert runtime.last_user_info is not None
    assert runtime.last_user_info.get("is_logged_in") is True
    assert runtime.last_user_info.get("email") == "user@example.com"

    monkeypatch.undo()


@patch_config_options({"server.enableXsrfProtection": False})
def test_websocket_accepts_existing_session(tmp_path: Path) -> None:
    """Test that WebSocket reconnection with existing session ID works."""
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


@patch_config_options({"global.developmentMode": False})
def test_static_files_fall_back_to_index(tmp_path: Path) -> None:
    """Ensure unknown paths return index.html so multipage routes work."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>home</html>")

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)

    with TestClient(app) as client:
        response = client.get("/page/does/not/exist")
        assert response.status_code == HTTPStatus.OK
        assert response.text == "<html>home</html>"
        assert response.headers["cache-control"] == "no-cache"

    monkeypatch.undo()


@patch_config_options({"global.developmentMode": False})
def test_static_files_apply_cache_headers(tmp_path: Path) -> None:
    """Ensure hashed static assets receive long-lived cache headers."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>home</html>")
    (static_dir / "app.123456.js").write_text("console.log('test')")

    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)

    with TestClient(app) as client:
        response = client.get("/app.123456.js")
        assert response.status_code == HTTPStatus.OK
        assert (
            response.headers["cache-control"]
            == f"public, immutable, max-age={STATIC_ASSET_CACHE_MAX_AGE_SECONDS}"
        )

    monkeypatch.undo()


@patch_config_options(
    {
        "server.enableXsrfProtection": True,
        "global.developmentMode": False,
        "server.cookieSecret": "test-signing-secret",
    }
)
def test_websocket_rejects_auth_cookie_without_valid_xsrf(tmp_path: Path) -> None:
    """Test that auth cookies are not parsed without valid XSRF token."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    # Create a valid auth cookie using Starlette's signing (itsdangerous-based)
    cookie_payload = json.dumps(
        {
            "origin": "http://testserver",
            "is_logged_in": True,
            "email": "user@example.com",
        }
    )
    cookie_value = starlette_app_utils.create_signed_value(
        "test-signing-secret",
        "_streamlit_user",
        cookie_payload,
    )

    # Set auth cookie but no XSRF cookie
    client.cookies.set("_streamlit_user", cookie_value.decode("utf-8"))

    # Connect without providing XSRF token in subprotocol
    with client.websocket_connect(
        "/_stcore/stream",
        headers={"Origin": "http://testserver"},
        subprotocols=["streamlit"],  # No XSRF token in second position
    ) as websocket:
        websocket.close(code=1000)

    # User info should NOT include auth data because XSRF validation failed
    assert runtime.last_user_info is not None
    assert runtime.last_user_info.get("is_logged_in") is not True
    assert runtime.last_user_info.get("email") is None

    monkeypatch.undo()


@patch_config_options(
    {
        "global.developmentMode": False,
        "global.e2eTest": False,
        "server.enableXsrfProtection": False,
    }
)
def test_websocket_ignores_debug_disconnect_in_production(tmp_path: Path) -> None:
    """Test that debug_disconnect_websocket is ignored in production mode."""

    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    with client.websocket_connect("/_stcore/stream") as websocket:
        # Send a debug_disconnect_websocket message
        back_msg = BackMsg()
        back_msg.debug_disconnect_websocket = True
        websocket.send_bytes(back_msg.SerializeToString())

        # Send a valid rerun message to verify connection is still alive
        back_msg2 = BackMsg()
        back_msg2.rerun_script.query_string = ""
        websocket.send_bytes(back_msg2.SerializeToString())

        # Close gracefully
        websocket.close(code=1000)

    # The runtime should have received the rerun message (connection wasn't closed)
    assert runtime.last_backmsg is not None
    _session_id, msg = runtime.last_backmsg
    assert msg.WhichOneof("type") == "rerun_script"

    monkeypatch.undo()


@patch_config_options(
    {
        "global.developmentMode": False,
        "global.e2eTest": False,
        "server.enableXsrfProtection": False,
    }
)
def test_websocket_ignores_debug_shutdown_in_production(tmp_path: Path) -> None:
    """Test that debug_shutdown_runtime is ignored in production mode."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    with client.websocket_connect("/_stcore/stream") as websocket:
        # Send a debug_shutdown_runtime message
        back_msg = BackMsg()
        back_msg.debug_shutdown_runtime = True
        websocket.send_bytes(back_msg.SerializeToString())

        # Send a valid rerun message to verify connection is still alive
        back_msg2 = BackMsg()
        back_msg2.rerun_script.query_string = ""
        websocket.send_bytes(back_msg2.SerializeToString())

        # Close gracefully
        websocket.close(code=1000)

    # Runtime should NOT be stopped
    assert runtime.stopped is False

    monkeypatch.undo()


@patch_config_options(
    {
        "global.developmentMode": True,
        "global.e2eTest": False,
        "server.enableXsrfProtection": False,
    }
)
def test_websocket_allows_debug_shutdown_in_dev_mode(tmp_path: Path) -> None:
    """Test that debug_shutdown_runtime works in development mode."""

    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    runtime = _DummyRuntime(component_dir)
    app = create_starlette_app(runtime)
    client = TestClient(app)

    with client.websocket_connect("/_stcore/stream") as websocket:
        # Send a debug_shutdown_runtime message
        back_msg = BackMsg()
        back_msg.debug_shutdown_runtime = True
        websocket.send_bytes(back_msg.SerializeToString())

    # Runtime should be stopped
    assert runtime.stopped is True
