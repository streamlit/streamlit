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
from contextlib import asynccontextmanager
from http import HTTPStatus
from pathlib import Path
from typing import TYPE_CHECKING, Any

import pytest
from starlette.applications import Starlette
from starlette.middleware import Middleware
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Route
from starlette.testclient import TestClient

from streamlit import file_util
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.openmetrics_data_model_pb2 import MetricSet as MetricSetProto
from streamlit.runtime.media_file_manager import MediaFileManager, MediaFileMetadata
from streamlit.runtime.media_file_storage import MediaFileKind
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.stats import CacheStat, CounterStat, GaugeStat
from streamlit.runtime.uploaded_file_manager import UploadedFileRec
from streamlit.web.server.starlette import starlette_app_utils
from streamlit.web.server.starlette.starlette_app import (
    _RESERVED_ROUTE_PREFIXES,
    App,
    create_starlette_app,
    create_streamlit_middleware,
)
from streamlit.web.server.starlette.starlette_gzip_middleware import (
    SelectiveGZipMiddleware,
    _should_bypass_static_gzip,
)
from streamlit.web.server.starlette.starlette_routes import _stats_to_proto
from streamlit.web.server.starlette.starlette_server_config import (
    ANYIO_STATIC_FILE_THREAD_TOKENS,
)
from streamlit.web.server.starlette.starlette_static_routes import (
    STATIC_ASSET_CACHE_MAX_AGE_SECONDS,
)
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterator

    from starlette.requests import Request


class _DummyStatsManager:
    def __init__(self) -> None:
        self._stats: dict[str, list[CacheStat | CounterStat | GaugeStat]] = {
            "cache_memory_bytes": [CacheStat("test_cache", "", 1)],
            "session_events": [
                CounterStat(
                    family_name="session_events",
                    value=5,
                    labels={"type": "connect"},
                    help="Total count of session events by type.",
                )
            ],
            "session_duration_seconds": [
                CounterStat(
                    family_name="session_duration_seconds",
                    value=42,
                    unit="seconds",
                    help="Total time spent in active sessions, in seconds.",
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
        # Configurable health response for testing
        self._is_ready: tuple[bool, str] = (True, "ok")
        # Runtime state for testing health endpoint messages
        self._state: str = "ONE_OR_MORE_SESSIONS_CONNECTED"

    @property
    def state(self) -> Any:
        """Return a mock runtime state."""
        from streamlit.runtime import RuntimeState

        state_map = {
            "INITIAL": RuntimeState.INITIAL,
            "NO_SESSIONS_CONNECTED": RuntimeState.NO_SESSIONS_CONNECTED,
            "ONE_OR_MORE_SESSIONS_CONNECTED": RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED,
            "STOPPING": RuntimeState.STOPPING,
            "STOPPED": RuntimeState.STOPPED,
        }
        return state_map.get(self._state, RuntimeState.ONE_OR_MORE_SESSIONS_CONNECTED)

    @property
    def is_ready_for_browser_connection(self) -> asyncio.Future[tuple[bool, str]]:
        loop = asyncio.get_event_loop()
        fut: asyncio.Future[tuple[bool, str]] = loop.create_future()
        fut.set_result(self._is_ready)
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
    # Starlette's StaticFiles requires index.html to exist when html=True
    (static_dir / "index.html").write_text("<html>test</html>")
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")
    (component_dir / "bundle.js").write_text("console.log('component');")

    with patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            # Disable XSRF for basic tests
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


@pytest.mark.parametrize(
    ("path", "expected"),
    [
        ("/", True),
        ("/static/app.123.js", True),
        ("/app/static/logo.svg", False),
        ("/assets/theme.css", False),
        ("/_stcore/metrics", False),
        ("/media/file", False),
    ],
    ids=[
        "root",
        "static-bundle",
        "app-static",
        "hashed-style",
        "api-route",
        "media-route",
    ],
)
def test_should_bypass_static_gzip(path: str, expected: bool) -> None:
    """Only root and `/static/...` paths should bypass the gzip middleware."""
    assert _should_bypass_static_gzip(path) is expected


def test_create_streamlit_middleware_uses_selective_gzip() -> None:
    """The Streamlit middleware stack should use the selective gzip wrapper."""
    middleware_list = create_streamlit_middleware()

    assert middleware_list[2].cls is SelectiveGZipMiddleware


def test_selective_gzip_skips_static_like_paths() -> None:
    """Only `/static/...` paths should bypass gzip while API paths compress."""

    async def javascript_asset(_: Any) -> PlainTextResponse:
        return PlainTextResponse("x" * 2000, media_type="application/javascript")

    async def json_api(_: Any) -> PlainTextResponse:
        return PlainTextResponse("x" * 2000, media_type="application/json")

    app = Starlette(
        routes=[
            Route("/static/app.123.js", javascript_asset),
            Route("/_stcore/data", json_api),
        ],
        middleware=create_streamlit_middleware(),
    )

    with TestClient(app) as client:
        static_response = client.get(
            "/static/app.123.js", headers={"Accept-Encoding": "gzip"}
        )
        api_response = client.get("/_stcore/data", headers={"Accept-Encoding": "gzip"})

    assert static_response.status_code == HTTPStatus.OK
    assert static_response.headers.get("content-encoding") is None
    assert api_response.status_code == HTTPStatus.OK
    assert api_response.headers.get("content-encoding") == "gzip"


def test_create_starlette_app_sets_anyio_thread_limiter(
    tmp_path: Path, monkeypatch: pytest.MonkeyPatch
) -> None:
    """The Starlette app lifespan should apply the measured AnyIO thread limit."""
    component_dir = tmp_path / "component"
    component_dir.mkdir()
    (component_dir / "index.html").write_text("component")

    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "index.html").write_text("<html>test</html>")
    monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    runtime = _DummyRuntime(component_dir)
    observed: dict[str, int] = {}

    async def start() -> None:
        from anyio import to_thread

        observed["tokens"] = to_thread.current_default_thread_limiter().total_tokens

    runtime.start = start
    app = create_starlette_app(runtime)

    with TestClient(app):
        pass

    assert observed["tokens"] == ANYIO_STATIC_FILE_THREAD_TOKENS


def test_metrics_endpoint(starlette_client: tuple[TestClient, _DummyRuntime]) -> None:
    """Test that the metrics endpoint returns stats in text format."""
    client, _ = starlette_client
    response = client.get("/_stcore/metrics")
    assert response.status_code == 200
    assert "cache_memory_bytes" in response.text
    assert "session_events_total" in response.text
    assert "# TYPE session_events counter" in response.text
    assert (
        "# HELP session_events Total count of session events by type." in response.text
    )
    assert "# UNIT session_events " not in response.text
    assert "# TYPE session_duration_seconds counter" in response.text
    assert "# UNIT session_duration_seconds seconds" in response.text
    assert (
        "# HELP session_duration_seconds Total time spent in active sessions, in seconds."
        in response.text
    )
    assert "session_duration_seconds_total 42" in response.text
    assert "active_sessions" in response.text
    assert "# HELP active_sessions Current number of active sessions." in response.text
    assert "# UNIT active_sessions " not in response.text


def test_metrics_endpoint_filters_single_family(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Test that the metrics endpoint filters by a single family."""
    client, _ = starlette_client
    response = client.get("/_stcore/metrics?families=session_events")
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
        "/_stcore/metrics?families=session_events&families=active_sessions"
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
    expected_proto = _stats_to_proto(expected).SerializeToString()
    assert response.content == expected_proto


def test_metrics_endpoint_protobuf_uses_canonical_family_name(
    starlette_client: tuple[TestClient, _DummyRuntime],
) -> None:
    """Unitful counters should use the canonical family name in protobuf."""
    client, _ = starlette_client
    response = client.get(
        "/_stcore/metrics",
        headers={"Accept": "application/x-protobuf"},
    )
    assert response.status_code == 200

    metric_set = MetricSetProto()
    metric_set.ParseFromString(response.content)
    family_names = {metric_family.name for metric_family in metric_set.metric_families}

    assert "session_duration_seconds" in family_names
    assert "session_duration_seconds_total" not in family_names


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
    assert response.headers.get("Content-Encoding") in {None, "identity"}


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
    assert response.headers.get("Content-Encoding") in {None, "identity"}


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
    assert response.headers.get("Content-Encoding") in {None, "identity"}


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


@patch_config_options(
    {
        "global.developmentMode": False,
        "client.allowedOrigins": [
            "https://custom.example.com",
            "https://another.example.com",
        ],
    }
)
def test_host_config_custom_allowed_origins(tmp_path: Path) -> None:
    """Test that custom client.allowedOrigins values are used."""
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
    assert body["allowedOrigins"] == [
        "https://custom.example.com",
        "https://another.example.com",
    ]
    # Verify defaults are NOT included when custom values are set
    assert "https://*.streamlit.app" not in body["allowedOrigins"]

    monkeypatch.undo()


@patch_config_options(
    {
        "global.developmentMode": False,
        "client.allowedOrigins": [],
    }
)
def test_host_config_empty_allowed_origins(tmp_path: Path) -> None:
    """Test that empty client.allowedOrigins results in empty list."""
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
    assert body["allowedOrigins"] == []

    monkeypatch.undo()


@patch_config_options(
    {
        "global.developmentMode": True,
        "client.allowedOrigins": [
            "https://custom.example.com",
            "https://another.example.com",
        ],
    }
)
def test_host_config_custom_origins_with_dev_mode(tmp_path: Path) -> None:
    """Test that localhost is appended to custom origins in dev mode."""
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
    # Custom origins should be present
    assert "https://custom.example.com" in body["allowedOrigins"]
    assert "https://another.example.com" in body["allowedOrigins"]
    # localhost should be appended in dev mode
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


# ---------------------------------------------------------------------------
# Tests for the App class (st.App ASGI entry point)
# ---------------------------------------------------------------------------


class TestAppInit:
    """Tests for App initialization."""

    def test_app_accepts_string_path(self) -> None:
        """Test that App accepts a string script path."""
        from pathlib import Path

        app = App("main.py")
        assert app.script_path == Path("main.py")

    def test_app_accepts_path_object(self) -> None:
        """Test that App accepts a Path object as script path."""
        from pathlib import Path

        app = App(Path("main.py"))
        assert app.script_path == Path("main.py")

    def test_app_state_is_empty_initially(self) -> None:
        """Test that App state is empty on initialization."""
        app = App("main.py")
        assert app.state == {}

    def test_app_stores_user_routes(self) -> None:
        """Test that App stores user-provided routes."""

        async def handler(request: Any) -> None:
            pass

        routes = [Route("/api/health", handler)]
        app = App("main.py", routes=routes)
        assert len(app._user_routes) == 1

    def test_app_stores_user_middleware(self) -> None:
        """Test that App stores user-provided middleware."""
        from starlette.middleware.cors import CORSMiddleware

        middleware = [Middleware(CORSMiddleware, allow_origins=["*"])]
        app = App("main.py", middleware=middleware)
        assert len(app._user_middleware) == 1

    def test_app_stores_exception_handlers(self) -> None:
        """Test that App stores user-provided exception handlers."""

        async def handler(request: Any, exc: Exception) -> None:
            pass

        handlers = {ValueError: handler}
        app = App("main.py", exception_handlers=handlers)
        assert ValueError in app._exception_handlers

    def test_app_stores_debug_flag(self) -> None:
        """Test that App stores the debug flag."""
        app = App("main.py", debug=True)
        assert app._debug is True


class TestAppRouteValidation:
    """Tests for route validation in App."""

    @pytest.mark.parametrize("reserved_prefix", _RESERVED_ROUTE_PREFIXES)
    def test_app_rejects_reserved_route_prefix(self, reserved_prefix: str) -> None:
        """Test that App rejects routes that conflict with reserved prefixes."""

        async def handler(request: Any) -> None:
            pass

        route_path = f"{reserved_prefix}custom"
        routes = [Route(route_path, handler)]

        with pytest.raises(ValueError, match="conflicts with reserved Streamlit route"):
            App("main.py", routes=routes)

    def test_app_rejects_reserved_route_without_trailing_slash(self) -> None:
        """Test that App rejects reserved routes without trailing slash."""

        async def handler(request: Any) -> None:
            pass

        routes = [Route("/_stcore", handler)]
        with pytest.raises(ValueError, match="conflicts with reserved Streamlit route"):
            App("main.py", routes=routes)

    def test_app_accepts_non_reserved_routes(self) -> None:
        """Test that App accepts routes that don't conflict with reserved prefixes."""

        async def handler(request: Any) -> None:
            pass

        routes = [
            Route("/api/health", handler),
            Route("/webhook", handler),
            Route("/custom/route", handler),
        ]
        app = App("main.py", routes=routes)
        assert len(app._user_routes) == 3


class TestAppLifespan:
    """Tests for App lifespan handling."""

    def test_app_stores_user_lifespan(self) -> None:
        """Test that App stores the user-provided lifespan context manager."""

        @asynccontextmanager
        async def lifespan(app: App) -> AsyncIterator[dict[str, Any]]:
            yield {"key": "value"}

        app = App("main.py", lifespan=lifespan)
        assert app._user_lifespan is not None

    def test_lifespan_method_creates_runtime(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that lifespan() creates the runtime if not already created."""
        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        app = App(script)
        assert app._runtime is None

        app.lifespan()

        assert app._runtime is not None
        # Runtime should be created but not started yet (lifespan will start it)
        from streamlit.runtime import RuntimeState

        assert app._runtime.state == RuntimeState.INITIAL

    def test_lifespan_method_sets_external_lifespan_flag(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that lifespan() sets _external_lifespan to True."""
        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        app = App(script)
        assert app._external_lifespan is False

        app.lifespan()

        assert app._external_lifespan is True

    def test_lifespan_method_returns_combined_lifespan(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that lifespan() returns the _combined_lifespan method."""
        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        app = App(script)
        result = app.lifespan()

        # Should return the bound method _combined_lifespan
        assert result == app._combined_lifespan
        assert callable(result)

    def test_lifespan_method_is_idempotent(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that calling lifespan() multiple times returns the same result."""
        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        app = App(script)

        # Call lifespan() multiple times
        result1 = app.lifespan()
        result2 = app.lifespan()

        # Should return the same bound method
        assert result1 == result2
        # Runtime should only be created once
        assert app._runtime is not None

    def test_external_lifespan_flag_defaults_to_false(self) -> None:
        """Test that _external_lifespan defaults to False."""
        app = App("main.py")
        assert app._external_lifespan is False

    def test_standalone_use_after_lifespan_raises_error(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that using app standalone after calling lifespan() raises RuntimeError."""
        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        app = App(script)
        # Call lifespan() which sets _external_lifespan = True
        app.lifespan()

        # Now trying to use the app standalone (which builds the starlette app)
        # should raise a RuntimeError
        with pytest.raises(RuntimeError, match="Cannot use App as standalone"):
            # Trigger __call__ which builds the starlette app
            asyncio.run(app({"type": "http"}, None, None))


class TestAppServerModeTracking:
    """Tests for server mode tracking in App."""

    @pytest.fixture(autouse=True)
    def reset_server_mode(self) -> Iterator[None]:
        """Reset the server mode before and after each test."""
        from streamlit import config

        original_mode = config._server_mode
        config._server_mode = None
        yield
        config._server_mode = original_mode

    def test_standalone_app_via_cli_sets_starlette_app_mode(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that standalone st.App via CLI keeps 'starlette-app' mode."""
        from streamlit import config

        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        # Simulate CLI setting the mode (bootstrap.run_asgi_app does this)
        config._server_mode = "starlette-app"

        app = App(script)

        with TestClient(app) as client:
            # _combined_lifespan runs and should NOT change mode
            # since _external_lifespan is False
            response = client.get("/_stcore/health")
            assert response.status_code == HTTPStatus.OK

        # Mode should remain starlette-app
        assert config._server_mode == "starlette-app"

    def test_mounted_app_via_cli_sets_asgi_mounted_mode(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that mounted st.App via CLI changes to 'asgi-mounted' mode."""
        from streamlit import config

        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        # Simulate CLI setting the mode (bootstrap.run_asgi_app does this)
        config._server_mode = "starlette-app"

        app = App(script)
        # Simulate mounting: calling lifespan() sets _external_lifespan = True
        app.lifespan()

        # Create a wrapper app that uses the lifespan
        from starlette.applications import Starlette

        wrapper = Starlette(lifespan=app.lifespan())
        wrapper.mount("/streamlit", app)

        with TestClient(wrapper) as client:
            # The combined lifespan runs and should change mode to asgi-mounted
            response = client.get("/streamlit/_stcore/health")
            assert response.status_code == HTTPStatus.OK

        # Mode should be changed to asgi-mounted
        assert config._server_mode == "asgi-mounted"

    def test_standalone_app_via_external_asgi_sets_asgi_server_mode(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that standalone st.App via external ASGI sets 'asgi-server' mode."""
        from streamlit import config

        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        # No CLI, so server_mode is None (simulating direct uvicorn usage)
        assert config._server_mode is None

        app = App(script)

        with TestClient(app) as client:
            # _combined_lifespan runs and should set mode to asgi-server
            response = client.get("/_stcore/health")
            assert response.status_code == HTTPStatus.OK

        # Mode should be asgi-server
        assert config._server_mode == "asgi-server"

    def test_mounted_app_via_external_asgi_sets_asgi_mounted_mode(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that mounted st.App via external ASGI sets 'asgi-mounted' mode."""
        from streamlit import config

        script = tmp_path / "app.py"
        script.write_text("import streamlit as st\nst.write('hello')")

        # No CLI, so server_mode is None (simulating direct uvicorn usage)
        assert config._server_mode is None

        app = App(script)
        # Simulate mounting: calling lifespan() sets _external_lifespan = True
        lifespan_cm = app.lifespan()

        # Create a wrapper app that uses the lifespan
        from starlette.applications import Starlette

        wrapper = Starlette(lifespan=lifespan_cm)
        wrapper.mount("/streamlit", app)

        with TestClient(wrapper) as client:
            # The combined lifespan runs and should set mode to asgi-mounted
            response = client.get("/streamlit/_stcore/health")
            assert response.status_code == HTTPStatus.OK

        # Mode should be asgi-mounted
        assert config._server_mode == "asgi-mounted"


class TestAppScriptPathResolution:
    """Tests for script path resolution in App."""

    def test_absolute_path_is_returned_unchanged(self, tmp_path: Path) -> None:
        """Test that absolute script paths are returned unchanged."""
        script_path = tmp_path / "main.py"
        script_path.touch()

        app = App(script_path)
        resolved = app._resolve_script_path()
        assert resolved == script_path

    def test_relative_path_is_resolved_to_cwd(self) -> None:
        """Test that relative script paths are resolved relative to cwd."""
        app = App("main.py")
        # The relative path should be resolved to an absolute path
        resolved = app._resolve_script_path()
        assert resolved.is_absolute()
        assert resolved.name == "main.py"
        # Without config._main_script_path set, should resolve relative to cwd
        assert resolved == (Path.cwd() / "main.py").resolve()

    def test_relative_path_uses_main_script_path_when_set(
        self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that relative paths resolve relative to main_script_path when set by CLI."""
        from streamlit import config

        # Simulate CLI setting the main script path
        main_script = tmp_path / "app" / "server.py"
        main_script.parent.mkdir(parents=True, exist_ok=True)
        main_script.touch()
        monkeypatch.setattr(config, "_main_script_path", str(main_script))

        app = App("pages/dashboard.py")
        resolved = app._resolve_script_path()

        # Should resolve relative to main_script_path's parent directory
        expected = (tmp_path / "app" / "pages" / "dashboard.py").resolve()
        assert resolved == expected
        # Should NOT resolve relative to cwd
        assert resolved != (Path.cwd() / "pages" / "dashboard.py").resolve()

    def test_nonexistent_script_raises_file_not_found(
        self, tmp_path: Path, reset_runtime: None
    ) -> None:
        """Test that a descriptive FileNotFoundError is raised for non-existent scripts."""
        nonexistent_script = tmp_path / "does_not_exist.py"
        app = App(nonexistent_script)

        with pytest.raises(FileNotFoundError) as exc_info:
            app._create_runtime()

        # Error message should include the path and be descriptive
        assert "does_not_exist.py" in str(exc_info.value)
        assert "not found" in str(exc_info.value).lower()


class TestAppExports:
    """Tests for App module exports."""

    def test_app_is_exported_from_starlette_package(self) -> None:
        """Test that App is exported from the web.server.starlette package."""
        from streamlit.web.server.starlette import App as ExportedApp

        assert ExportedApp is App

    def test_app_is_exported_from_streamlit_starlette(self) -> None:
        """Test that App is exported from the streamlit.starlette shortcut."""
        from streamlit.starlette import App as ShortcutApp

        assert ShortcutApp is App

    def test_app_is_exported_from_st_namespace(self) -> None:
        """Test that App is exported from the main st namespace."""
        import streamlit as st

        assert st.App is App

    def test_reserved_route_prefixes_constant(self) -> None:
        """Test that reserved route prefixes constant is defined correctly."""
        assert "/_stcore/" in _RESERVED_ROUTE_PREFIXES
        assert "/media/" in _RESERVED_ROUTE_PREFIXES
        assert "/component/" in _RESERVED_ROUTE_PREFIXES
        assert "/static/" in _RESERVED_ROUTE_PREFIXES


# --- Integration Tests for App class ---


@pytest.fixture
def simple_script(tmp_path: Path) -> Path:
    """Create a simple Streamlit script for testing."""
    script = tmp_path / "main.py"
    script.write_text('import streamlit as st\nst.write("Hello")\n')
    return script


@pytest.fixture
def reset_runtime() -> Iterator[None]:
    """Reset the Runtime singleton before and after each test."""
    from streamlit.runtime import Runtime

    Runtime._instance = None
    yield
    Runtime._instance = None


class TestAppAsgi:
    """Integration tests for App as an ASGI application."""

    @pytest.fixture(autouse=True)
    def _reset_runtime(self, reset_runtime: None) -> None:
        """Auto-use the reset_runtime fixture for all tests in this class."""

    @pytest.fixture(autouse=True)
    def _mock_static_dir(self, tmp_path: Path) -> Iterator[None]:
        """Mock the static directory for all tests in this class."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        # Starlette's StaticFiles requires index.html to exist when html=True
        (static_dir / "index.html").write_text("<html>test</html>")
        monkeypatch = pytest.MonkeyPatch()
        monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))
        yield
        monkeypatch.undo()

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_app_serves_health_endpoint(self, simple_script: Path) -> None:
        """Test that App serves Streamlit's health endpoint."""
        app = App(simple_script)
        with TestClient(app) as client:
            response = client.get("/_stcore/health")
            assert response.status_code == 200
            assert response.text == "ok"

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_app_serves_custom_routes(self, simple_script: Path) -> None:
        """Test that App serves user-provided custom routes."""

        async def api_health(request: Request) -> JSONResponse:
            return JSONResponse({"status": "healthy"})

        routes = [Route("/api/health", api_health)]
        app = App(simple_script, routes=routes)

        with TestClient(app) as client:
            response = client.get("/api/health")
            assert response.status_code == 200
            assert response.json() == {"status": "healthy"}

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_app_lifespan_populates_state(self, simple_script: Path) -> None:
        """Test that user lifespan can populate app state."""
        startup_count = 0
        shutdown_count = 0

        @asynccontextmanager
        async def lifespan(app: App) -> AsyncIterator[dict[str, Any]]:
            nonlocal startup_count, shutdown_count
            startup_count += 1
            yield {"model": "loaded", "version": "1.0"}
            shutdown_count += 1

        app = App(simple_script, lifespan=lifespan)

        with TestClient(app) as client:
            assert startup_count == 1
            assert app.state == {"model": "loaded", "version": "1.0"}
            # State should not contain unexpected keys
            assert len(app.state) == 2
            client.get("/_stcore/health")  # Just verify it works

        assert shutdown_count == 1

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_app_applies_custom_middleware(self, simple_script: Path) -> None:
        """Test that user-provided middleware is applied."""
        middleware_call_count = 0

        class TestMiddleware:
            def __init__(self, app: Any) -> None:
                self.app = app

            async def __call__(
                self, scope: dict[str, Any], receive: Any, send: Any
            ) -> None:
                nonlocal middleware_call_count
                if scope["type"] == "http":
                    middleware_call_count += 1
                await self.app(scope, receive, send)

        middleware = [Middleware(TestMiddleware)]
        app = App(simple_script, middleware=middleware)

        with TestClient(app) as client:
            client.get("/_stcore/health")
            # Middleware should be called exactly once for this request
            assert middleware_call_count == 1

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_app_custom_routes_have_priority_over_fallback(
        self, simple_script: Path
    ) -> None:
        """Test that custom routes take priority over Streamlit's fallback routes."""

        async def custom_root(request: Request) -> JSONResponse:
            return JSONResponse({"custom": True})

        routes = [Route("/", custom_root)]
        app = App(simple_script, routes=routes)

        with TestClient(app) as client:
            response = client.get("/")
            assert response.status_code == 200
            assert response.json() == {"custom": True}

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_app_lifespan_without_yield_state(self, simple_script: Path) -> None:
        """Test that lifespan works even when yielding None."""
        startup_called = False

        @asynccontextmanager
        async def lifespan(app: App) -> AsyncIterator[None]:
            nonlocal startup_called
            startup_called = True
            yield

        app = App(simple_script, lifespan=lifespan)

        with TestClient(app) as client:
            assert startup_called
            assert app.state == {}
            client.get("/_stcore/health")


class TestHealthEndpointMessages:
    """Tests for health endpoint state-specific messages."""

    @pytest.mark.parametrize(
        ("runtime_state", "expected_text"),
        [
            ("INITIAL", "Runtime not started"),
            ("STOPPING", "shutting down"),
            ("STOPPED", "stopped"),
        ],
        ids=["initial", "stopping", "stopped"],
    )
    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_health_returns_503_with_state_message(
        self,
        tmp_path: Path,
        runtime_state: str,
        expected_text: str,
        monkeypatch: pytest.MonkeyPatch,
    ) -> None:
        """Test that health endpoint returns 503 with state-specific messages."""
        component_dir = tmp_path / "component"
        component_dir.mkdir()
        (component_dir / "index.html").write_text("component")

        static_dir = tmp_path / "static"
        static_dir.mkdir()
        monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

        runtime = _DummyRuntime(component_dir)
        runtime._is_ready = (False, "not ready")
        runtime._state = runtime_state

        app = create_starlette_app(runtime)
        client = TestClient(app, raise_server_exceptions=False)

        response = client.get("/_stcore/health")

        assert response.status_code == 503
        assert expected_text.lower() in response.text.lower()


class TestAppAutoStart:
    """Tests for App auto-start runtime behavior when mounted without explicit lifespan."""

    @pytest.fixture(autouse=True)
    def _reset_runtime(self, reset_runtime: None) -> None:
        """Auto-use the reset_runtime fixture for all tests in this class."""

    @pytest.fixture(autouse=True)
    def _mock_static_dir(self, tmp_path: Path, monkeypatch: pytest.MonkeyPatch) -> None:
        """Mock the static directory for all tests in this class."""
        static_dir = tmp_path / "static"
        static_dir.mkdir()
        (static_dir / "index.html").write_text("<html>test</html>")
        monkeypatch.setattr(file_util, "get_static_dir", lambda: str(static_dir))

    @pytest.fixture(autouse=True)
    def _reset_server_mode(self) -> Iterator[None]:
        """Reset the server mode before and after each test."""
        from streamlit import config

        original_mode = config._server_mode
        config._server_mode = None
        yield
        config._server_mode = original_mode

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_auto_start_runtime_when_mounted_without_lifespan(
        self, simple_script: Path
    ) -> None:
        """Test that runtime auto-starts when App is mounted without explicit lifespan."""
        from starlette.applications import Starlette

        from streamlit import config
        from streamlit.runtime import RuntimeState

        app = App(simple_script)

        # Mount without using lifespan()
        wrapper = Starlette()
        wrapper.mount("/streamlit", app)

        # Before first request, runtime should not exist
        assert app._runtime is None

        with TestClient(wrapper) as client:
            # First request should trigger auto-start
            response = client.get("/streamlit/_stcore/health")
            assert response.status_code == 200

            # Runtime should now exist and be running
            assert app._runtime is not None
            assert app._auto_started is True
            # The runtime should have been started
            assert app._runtime.state != RuntimeState.INITIAL

        # Server mode should be set to asgi-mounted
        assert config._server_mode == "asgi-mounted"

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_auto_start_does_not_run_when_lifespan_used(
        self, simple_script: Path
    ) -> None:
        """Test that auto-start is not triggered when lifespan() is used."""
        from starlette.applications import Starlette

        app = App(simple_script)
        lifespan_cm = app.lifespan()

        wrapper = Starlette(lifespan=lifespan_cm)
        wrapper.mount("/streamlit", app)

        with TestClient(wrapper) as client:
            response = client.get("/streamlit/_stcore/health")
            assert response.status_code == 200

            # Runtime should exist but auto_started should be False
            assert app._runtime is not None
            assert app._auto_started is False

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_auto_start_warns_when_user_lifespan_provided_but_not_used(
        self, simple_script: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that a warning is logged when user provides lifespan but mounts without using it."""
        from contextlib import asynccontextmanager
        from unittest.mock import MagicMock

        from starlette.applications import Starlette

        from streamlit import logger

        # Mock the logger to capture warning calls
        mock_logger = MagicMock()
        monkeypatch.setattr(logger, "get_logger", lambda name: mock_logger)

        # User provides a lifespan to App.__init__
        @asynccontextmanager
        async def user_lifespan(app):
            yield

        app = App(simple_script, lifespan=user_lifespan)

        # But then mounts without calling app.lifespan() - this is a misconfiguration
        wrapper = Starlette()
        wrapper.mount("/streamlit", app)

        with TestClient(wrapper) as client:
            response = client.get("/streamlit/_stcore/health")
            assert response.status_code == 200

        # Should warn about the skipped lifespan
        mock_logger.warning.assert_called_once()
        warning_msg = mock_logger.warning.call_args[0][0].lower()
        assert "auto-starting runtime" in warning_msg
        assert "lifespan" in warning_msg

    @patch_config_options(
        {
            "server.baseUrlPath": "",
            "global.developmentMode": False,
            "server.enableXsrfProtection": False,
        }
    )
    def test_concurrent_requests_do_not_trigger_multiple_startups(
        self, simple_script: Path, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        """Test that concurrent requests don't trigger multiple runtime startups.

        The lock should ensure only one request can start the runtime even if
        multiple requests arrive simultaneously.
        """
        import asyncio
        from concurrent.futures import ThreadPoolExecutor

        from starlette.applications import Starlette

        from streamlit import config

        app = App(simple_script)

        # Track how many times _auto_start_runtime is called
        auto_start_call_count = 0
        original_auto_start = app._auto_start_runtime

        async def counting_auto_start() -> None:
            nonlocal auto_start_call_count
            auto_start_call_count += 1
            # Add small delay to increase chance of race condition
            await asyncio.sleep(0.1)
            await original_auto_start()

        wrapper = Starlette()
        wrapper.mount("/streamlit", app)

        # Patch after wrapper is created but before requests
        monkeypatch.setattr(app, "_auto_start_runtime", counting_auto_start)

        with TestClient(wrapper) as client:
            # Make multiple concurrent requests
            with ThreadPoolExecutor(max_workers=5) as executor:
                futures = [
                    executor.submit(client.get, "/streamlit/_stcore/health")
                    for _ in range(5)
                ]
                responses = [f.result() for f in futures]

            # All requests should succeed
            for response in responses:
                assert response.status_code == 200

        # Despite concurrent requests, _auto_start_runtime should only be called once
        assert auto_start_call_count == 1
        assert app._auto_started is True
        assert config._server_mode == "asgi-mounted"
