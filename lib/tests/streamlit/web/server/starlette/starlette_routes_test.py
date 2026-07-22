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

"""Unit tests for starlette_routes module."""

from __future__ import annotations

import asyncio
import string
from typing import TYPE_CHECKING, Any
from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from starlette.applications import Starlette
from starlette.datastructures import UploadFile
from starlette.exceptions import HTTPException
from starlette.responses import Response
from starlette.testclient import TestClient

from streamlit.runtime.media_file_storage import MediaFileKind
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.web.server.starlette.starlette_routes import (
    _ensure_xsrf_cookie,
    _set_cors_headers,
    _set_unquoted_cookie,
    _stats_to_proto,
    _with_base,
    create_app_static_serving_routes,
    create_bidi_component_routes,
    create_component_routes,
    create_health_routes,
    create_media_routes,
    create_metrics_routes,
    create_script_health_routes,
    create_upload_routes,
)
from streamlit.web.server.starlette.starlette_server_config import XSRF_COOKIE_NAME
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    from collections.abc import Callable
    from pathlib import Path

    from starlette.routing import BaseRoute


def _client_for(routes: list[BaseRoute]) -> TestClient:
    """Build a TestClient serving only the given routes."""
    return TestClient(Starlette(routes=routes))


def _endpoint_for(routes: list[BaseRoute], method: str) -> Callable[..., Any]:
    """Return the handler of the first route that accepts the given HTTP method."""
    for route in routes:
        if method in (getattr(route, "methods", None) or set()):
            return route.endpoint  # type: ignore[attr-defined]
    raise AssertionError(f"No route found for method {method}")


def _request_with_path(path: str) -> MagicMock:
    """Return a mock request whose only path parameter is ``path``."""
    request = MagicMock()
    request.path_params = {"path": path}
    return request


def _component_registry(component_root: str | None) -> MagicMock:
    """Return a mock component registry that resolves to ``component_root``."""
    registry = MagicMock()
    registry.get_component_path.return_value = component_root
    return registry


def _bidi_manager(component_root: str | None) -> MagicMock:
    """Return a mock manager for a registered bidi component at ``component_root``."""
    manager = MagicMock()
    manager.get.return_value = object()
    manager.get_component_path.return_value = component_root
    return manager


def _upload_routes() -> list[BaseRoute]:
    """Return upload routes backed by a runtime that treats every session as active."""
    runtime = MagicMock()
    runtime.is_active_session.return_value = True
    return create_upload_routes(
        runtime, MemoryUploadedFileManager("/_stcore/upload_file"), ""
    )


class TestWithBase:
    """Tests for _with_base function."""

    @patch_config_options({"server.baseUrlPath": ""})
    def test_no_base_url(self) -> None:
        """Test path with no base URL configured."""
        result = _with_base("_stcore/health")

        assert result == "/_stcore/health"

    @patch_config_options({"server.baseUrlPath": ""})
    def test_no_base_url_with_leading_slash(self) -> None:
        """Test path with leading slash and no base URL."""
        result = _with_base("/_stcore/health")

        assert result == "/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "myapp"})
    def test_with_base_url(self) -> None:
        """Test path with base URL configured."""
        result = _with_base("_stcore/health")

        assert result == "/myapp/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "/myapp/"})
    def test_strips_slashes_from_base(self) -> None:
        """Test that slashes are stripped from base URL."""
        result = _with_base("_stcore/health")

        assert result == "/myapp/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "shouldbeignored"})
    def test_explicit_base_url_overrides_config(self) -> None:
        """Test that explicit base_url parameter overrides config."""
        result = _with_base("_stcore/health", base_url="custom")

        assert result == "/custom/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "shouldbeignored"})
    def test_explicit_empty_base_url(self) -> None:
        """Test that explicit empty base_url works."""
        result = _with_base("_stcore/health", base_url="")

        assert result == "/_stcore/health"

    @patch_config_options({"server.baseUrlPath": "fromconfig"})
    def test_explicit_none_base_url_uses_config(self) -> None:
        """Test that explicit None uses config."""
        result = _with_base("_stcore/health", base_url=None)

        assert result == "/fromconfig/_stcore/health"


class TestSetCorsHeaders:
    """Tests for _set_cors_headers function."""

    @patch_config_options({"server.enableCORS": False})
    def test_allows_all_when_cors_disabled(self) -> None:
        """Test that all origins are allowed when CORS is disabled."""

        request = MagicMock()
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert response.headers["Access-Control-Allow-Origin"] == "*"

    @patch_config_options({"global.developmentMode": True, "server.enableCORS": True})
    def test_allows_all_in_dev_mode(self) -> None:
        """Test that all origins are allowed in development mode."""
        request = MagicMock()
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert response.headers["Access-Control-Allow-Origin"] == "*"

    @patch_config_options(
        {
            "server.enableCORS": True,
            "global.developmentMode": False,
        }
    )
    def test_no_header_when_origin_not_allowed(self) -> None:
        """Test that no header is set when origin is not in allowed list."""
        request = MagicMock()
        request.headers = MagicMock()
        # This origin won't be in any allowed list by default
        request.headers.get.return_value = "http://random-untrusted-origin.com"
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert "Access-Control-Allow-Origin" not in response.headers

    @patch_config_options(
        {
            "server.enableCORS": True,
            "global.developmentMode": False,
        }
    )
    def test_no_header_when_no_origin(self) -> None:
        """Test that no header is set when request has no Origin header."""
        request = MagicMock()
        request.headers = MagicMock()
        request.headers.get.return_value = None
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert "Access-Control-Allow-Origin" not in response.headers

    @patch_config_options(
        {
            "server.enableCORS": True,
            "global.developmentMode": False,
            "server.corsAllowedOrigins": ["http://allowed.example.com"],
        }
    )
    def test_allows_configured_origin(self) -> None:
        """Test that configured allowed origins are permitted."""
        request = MagicMock()
        request.headers = MagicMock()
        request.headers.get.return_value = "http://allowed.example.com"
        response = MagicMock()
        response.headers = {}

        asyncio.run(_set_cors_headers(request, response))

        assert (
            response.headers["Access-Control-Allow-Origin"]
            == "http://allowed.example.com"
        )


class TestEnsureXsrfCookie:
    """Tests for _ensure_xsrf_cookie function."""

    @patch_config_options({"server.enableXsrfProtection": False})
    def test_no_cookie_when_xsrf_disabled(self) -> None:
        """Test that no cookie is set when XSRF protection is disabled."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 0

    @patch_config_options(
        {"server.enableXsrfProtection": True, "server.sslCertFile": None}
    )
    def test_generates_new_token_when_no_cookie(self) -> None:
        """Test that a new XSRF token is generated when no cookie exists."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert cookie_headers[0].startswith(f"{XSRF_COOKIE_NAME}=2|")
        assert "SameSite=Lax" in cookie_headers[0]
        assert "Secure" not in cookie_headers[0]

    @patch_config_options(
        {"server.enableXsrfProtection": True, "server.sslCertFile": "/path/to/cert"}
    )
    def test_sets_secure_flag_with_ssl(self) -> None:
        """Test that Secure flag is added when SSL is configured."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "Secure" in cookie_headers[0]

    @patch_config_options(
        {"server.enableXsrfProtection": True, "server.sslCertFile": None}
    )
    @patch(
        "streamlit.web.server.starlette.starlette_routes.starlette_app_utils.decode_xsrf_token_string"
    )
    @patch(
        "streamlit.web.server.starlette.starlette_routes.starlette_app_utils.generate_xsrf_token_string"
    )
    def test_preserves_existing_token(
        self, mock_generate: MagicMock, mock_decode: MagicMock
    ) -> None:
        """Test that existing token bytes and timestamp are preserved."""
        existing_token = b"existing_token_bytes"
        existing_timestamp = 1234567890
        mock_decode.return_value = (existing_token, existing_timestamp)
        mock_generate.return_value = "2|mocked|token|1234567890"

        request = MagicMock()
        request.cookies = {XSRF_COOKIE_NAME: "existing_cookie_value"}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        mock_decode.assert_called_once_with("existing_cookie_value")
        mock_generate.assert_called_once_with(existing_token, existing_timestamp)

    @patch_config_options(
        {
            "server.enableXsrfProtection": True,
            "server.sslCertFile": None,
            "server.xsrfCookieSameSite": "none",
        }
    )
    def test_same_site_none_forces_secure(self) -> None:
        """SameSite=None must force the Secure flag even without SSL configured.

        Browsers reject ``SameSite=None`` cookies that are not also ``Secure``,
        so omitting Secure here would silently break cross-origin embedding.
        """
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "SameSite=None" in cookie_headers[0]
        assert "Secure" in cookie_headers[0]

    @patch_config_options(
        {
            "server.enableXsrfProtection": True,
            "server.sslCertFile": "/path/to/cert",
            "server.xsrfCookieSameSite": "none",
        }
    )
    def test_same_site_none_with_ssl_is_secure(self) -> None:
        """SameSite=None combined with SSL still yields a single Secure flag."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "SameSite=None" in cookie_headers[0]
        assert cookie_headers[0].count("Secure") == 1

    @patch_config_options(
        {
            "server.enableXsrfProtection": True,
            "server.sslCertFile": None,
            "server.xsrfCookieSameSite": "strict",
        }
    )
    def test_same_site_strict_does_not_force_secure(self) -> None:
        """SameSite=Strict is reflected in the cookie without forcing Secure."""
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "SameSite=Strict" in cookie_headers[0]
        assert "Secure" not in cookie_headers[0]

    @patch_config_options(
        {
            "server.enableXsrfProtection": True,
            "server.sslCertFile": None,
            "server.xsrfCookieSameSite": None,
        }
    )
    def test_non_string_same_site_falls_back_to_lax(self) -> None:
        """A non-string SameSite value falls back to Lax without forcing Secure.

        This guards against a None config (e.g. TOML null) being coerced into
        SameSite=None with a forced Secure flag.
        """
        request = MagicMock()
        request.cookies = {}
        response = Response()

        _ensure_xsrf_cookie(request, response)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "SameSite=Lax" in cookie_headers[0]
        assert "Secure" not in cookie_headers[0]


class TestSetUnquotedCookie:
    """Tests for _set_unquoted_cookie function."""

    def test_sets_cookie_without_quoting(self) -> None:
        """Test that cookie value is set without URL encoding or quoting."""

        response = Response()
        cookie_value = "2|abcd1234|efgh5678|1234567890"

        _set_unquoted_cookie(response, "test_cookie", cookie_value, secure=False)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert cookie_headers[0].startswith(f"test_cookie={cookie_value};")
        assert "Path=/" in cookie_headers[0]
        assert "SameSite=Lax" in cookie_headers[0]
        assert "Secure" not in cookie_headers[0]

    def test_sets_custom_same_site(self) -> None:
        """A custom SameSite value is reflected in the Set-Cookie header."""

        response = Response()

        _set_unquoted_cookie(
            response, "test_cookie", "value", same_site="None", secure=True
        )

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "SameSite=None" in cookie_headers[0]
        assert "Secure" in cookie_headers[0]

    def test_sets_secure_flag_when_requested(self) -> None:
        """Test that Secure flag is added when secure=True."""

        response = Response()

        _set_unquoted_cookie(response, "test_cookie", "value", secure=True)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "Secure" in cookie_headers[0]

    def test_replaces_existing_cookie_with_same_name(self) -> None:
        """Test that setting a cookie replaces any existing cookie with the same name."""

        response = Response()
        response.set_cookie("test_cookie", "old_value")

        _set_unquoted_cookie(response, "test_cookie", "new_value", secure=False)

        cookie_headers = [
            value.decode("latin-1")
            for name, value in response.raw_headers
            if name.lower() == b"set-cookie"
        ]
        assert len(cookie_headers) == 1
        assert "new_value" in cookie_headers[0]
        assert "old_value" not in cookie_headers[0]


def test_stats_to_proto_skips_empty_families() -> None:
    """Families without any stats are omitted from the generated MetricSet."""
    metric_set = _stats_to_proto({"empty_family": []})

    assert len(metric_set.metric_families) == 0


def test_health_options_returns_no_content() -> None:
    """The health OPTIONS handler responds 204 with a no-cache header."""
    routes = create_health_routes(MagicMock(), "")
    response = _client_for(routes).options("/_stcore/health")

    assert response.status_code == 204
    assert response.headers["Cache-Control"] == "no-cache"


def test_script_health_options_returns_no_content() -> None:
    """The script-health OPTIONS handler responds 204 with a no-cache header."""
    routes = create_script_health_routes(MagicMock(), "")
    response = _client_for(routes).options("/_stcore/script-health-check")

    assert response.status_code == 204
    assert response.headers["Cache-Control"] == "no-cache"


def test_metrics_options_advertises_allowed_methods() -> None:
    """The metrics OPTIONS handler responds 204 and advertises GET/OPTIONS."""
    routes = create_metrics_routes(MagicMock(), "")
    response = _client_for(routes).options("/_stcore/metrics")

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Methods"] == "GET, OPTIONS"
    assert response.headers["Access-Control-Allow-Headers"] == "Accept"


def test_media_endpoint_missing_file_returns_404() -> None:
    """Requesting an unknown media file yields a 404 response."""
    routes = create_media_routes(MemoryMediaFileStorage("/media"), "")
    response = _client_for(routes).get("/media/does-not-exist")

    assert response.status_code == 404


def test_media_endpoint_downloadable_without_filename_uses_default() -> None:
    """A downloadable file without a filename gets a generated default name."""
    storage = MemoryMediaFileStorage("/media")
    file_id = storage.load_and_get_id(
        b"payload", "text/plain", MediaFileKind.DOWNLOADABLE, None
    )
    routes = create_media_routes(storage, "")

    response = _client_for(routes).get(f"/media/{file_id}")

    assert response.status_code == 200
    assert "streamlit_download" in response.headers["content-disposition"]


def test_media_endpoint_downloadable_non_latin1_filename_uses_utf8() -> None:
    """A filename that cannot be latin-1 encoded uses the RFC 5987 utf-8 form."""
    storage = MemoryMediaFileStorage("/media")
    file_id = storage.load_and_get_id(
        b"payload", "text/plain", MediaFileKind.DOWNLOADABLE, "\u6587\u4ef6.txt"
    )
    routes = create_media_routes(storage, "")

    response = _client_for(routes).get(f"/media/{file_id}")

    assert response.status_code == 200
    assert "filename*=utf-8''" in response.headers["content-disposition"]


def test_media_options_returns_no_content() -> None:
    """The media OPTIONS handler responds 204."""
    routes = create_media_routes(MemoryMediaFileStorage("/media"), "")
    response = _client_for(routes).options("/media/anything")

    assert response.status_code == 204


def test_upload_options_advertises_allowed_methods() -> None:
    """The upload OPTIONS handler responds 204 and advertises PUT/OPTIONS/DELETE."""
    routes = _upload_routes()
    with patch_config_options({"server.enableXsrfProtection": False}):
        response = _client_for(routes).options("/_stcore/upload_file/s/f")

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Methods"] == "PUT, OPTIONS, DELETE"


def test_upload_put_wrong_file_count_returns_400() -> None:
    """A form that does not contain exactly one file is rejected with 400."""
    routes = _upload_routes()

    with patch_config_options({"server.enableXsrfProtection": False}):
        response = _client_for(routes).put(
            "/_stcore/upload_file/session123/fileid", data={"not_a_file": "value"}
        )

    assert response.status_code == 400
    assert "Expected 1 file" in response.text


def test_upload_put_invalid_content_length_returns_400() -> None:
    """A non-numeric Content-Length header is rejected with 400."""
    endpoint = _endpoint_for(_upload_routes(), "PUT")

    request = MagicMock()
    request.headers = {"content-length": "not-a-number"}
    request.cookies = {}
    request.path_params = {"session_id": "session123", "file_id": "fileid"}

    with patch_config_options({"server.enableXsrfProtection": False}):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(endpoint(request))

    assert exc_info.value.status_code == 400
    assert "Invalid Content-Length" in exc_info.value.detail


def test_upload_put_oversized_body_returns_413() -> None:
    """A body that exceeds the configured max upload size is rejected with 413."""
    endpoint = _endpoint_for(_upload_routes(), "PUT")

    upload = MagicMock(spec=UploadFile)
    upload.read = AsyncMock(return_value=b"x" * 100)
    upload.file = MagicMock()
    upload.filename = "foo.txt"
    upload.content_type = "text/plain"
    form = MagicMock()
    form.values.return_value = [upload]

    request = MagicMock()
    request.headers = {}
    request.cookies = {}
    request.path_params = {"session_id": "session123", "file_id": "fileid"}
    request.form = AsyncMock(return_value=form)

    with patch_config_options(
        {"server.enableXsrfProtection": False, "server.maxUploadSize": 0}
    ):
        with pytest.raises(HTTPException) as exc_info:
            asyncio.run(endpoint(request))

    assert exc_info.value.status_code == 413
    upload.file.close.assert_called_once()


def test_component_endpoint_empty_path_returns_404() -> None:
    """An empty component path is rejected with 404."""
    endpoint = _endpoint_for(create_component_routes(MagicMock(), ""), "GET")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(endpoint(_request_with_path("")))

    assert exc_info.value.status_code == 404


def test_component_endpoint_unknown_component_returns_404() -> None:
    """A request for an unregistered component yields 404."""
    routes = create_component_routes(_component_registry(None), "")

    response = _client_for(routes).get("/component/unknown/index.html")

    assert response.status_code == 404


def test_component_endpoint_unsafe_path_returns_400(tmp_path: Path) -> None:
    """A component path with an unsafe pattern is rejected with 400."""
    routes = create_component_routes(_component_registry(str(tmp_path)), "")
    endpoint = _endpoint_for(routes, "GET")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(endpoint(_request_with_path("comp/\x00evil")))

    assert exc_info.value.status_code == 400


def test_component_endpoint_directory_returns_404(tmp_path: Path) -> None:
    """Reading a component path that points at a directory yields 404."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    (comp_dir / "sub").mkdir()
    routes = create_component_routes(_component_registry(str(comp_dir)), "")

    response = _client_for(routes).get("/component/comp/sub")

    assert response.status_code == 404


def test_component_endpoint_serves_html_as_no_cache(tmp_path: Path) -> None:
    """An HTML component asset is served with a no-cache header."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    (comp_dir / "index.html").write_text("<html></html>")
    routes = create_component_routes(_component_registry(str(comp_dir)), "")

    response = _client_for(routes).get("/component/comp/index.html")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-cache"


def test_component_endpoint_serves_non_html_asset_as_public(tmp_path: Path) -> None:
    """A non-HTML component asset is served with a public cache header."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    (comp_dir / "bundle.js").write_text("console.log('hi');")
    routes = create_component_routes(_component_registry(str(comp_dir)), "")

    response = _client_for(routes).get("/component/comp/bundle.js")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "public"


def test_component_options_returns_no_content() -> None:
    """The component OPTIONS handler responds 204."""
    routes = create_component_routes(MagicMock(), "")
    response = _client_for(routes).options("/component/comp/index.html")

    assert response.status_code == 204


def test_bidi_component_empty_name_returns_404() -> None:
    """An empty bidi component name yields a 404 text response."""
    endpoint = _endpoint_for(create_bidi_component_routes(MagicMock(), ""), "GET")

    response = asyncio.run(endpoint(_request_with_path("")))

    assert response.status_code == 404
    assert response.body == b"not found"


def test_bidi_component_unregistered_returns_404() -> None:
    """A bidi component that is not registered yields 404."""
    manager = MagicMock()
    manager.get.return_value = None
    routes = create_bidi_component_routes(manager, "")

    response = _client_for(routes).get("/_stcore/bidi-components/unknown/main.js")

    assert response.status_code == 404


def test_bidi_component_missing_root_returns_404() -> None:
    """A registered bidi component without a resolvable root yields 404."""
    routes = create_bidi_component_routes(_bidi_manager(None), "")

    response = _client_for(routes).get("/_stcore/bidi-components/comp/main.js")

    assert response.status_code == 404


def test_bidi_component_empty_filename_returns_404(tmp_path: Path) -> None:
    """A bidi component request without a filename yields 404."""
    routes = create_bidi_component_routes(_bidi_manager(str(tmp_path)), "")

    response = _client_for(routes).get("/_stcore/bidi-components/comp")

    assert response.status_code == 404


def test_bidi_component_unsafe_path_returns_400(tmp_path: Path) -> None:
    """A bidi component path with an unsafe pattern is rejected with 400."""
    routes = create_bidi_component_routes(_bidi_manager(str(tmp_path)), "")
    endpoint = _endpoint_for(routes, "GET")

    response = asyncio.run(endpoint(_request_with_path("comp/\x00evil")))

    assert response.status_code == 400
    assert response.body == b"Bad Request"


def test_bidi_component_directory_returns_404(tmp_path: Path) -> None:
    """A bidi component path that points at a directory yields 404."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    (comp_dir / "sub").mkdir()
    routes = create_bidi_component_routes(_bidi_manager(str(comp_dir)), "")

    response = _client_for(routes).get("/_stcore/bidi-components/comp/sub")

    assert response.status_code == 404


def test_bidi_component_read_error_returns_404(tmp_path: Path) -> None:
    """A bidi component asset that cannot be read yields a 404 text response."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    routes = create_bidi_component_routes(_bidi_manager(str(comp_dir)), "")

    response = _client_for(routes).get("/_stcore/bidi-components/comp/missing.js")

    assert response.status_code == 404
    assert response.text == "read error"


def test_bidi_component_serves_non_html_asset_as_public(tmp_path: Path) -> None:
    """A non-HTML bidi component asset is served with a public cache header."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    (comp_dir / "bundle.js").write_text("console.log('hi');")
    routes = create_bidi_component_routes(_bidi_manager(str(comp_dir)), "")

    response = _client_for(routes).get("/_stcore/bidi-components/comp/bundle.js")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "public"


def test_bidi_component_serves_html_as_no_cache(tmp_path: Path) -> None:
    """An HTML bidi component asset is served with a no-cache header."""
    comp_dir = tmp_path / "comp"
    comp_dir.mkdir()
    (comp_dir / "index.html").write_text("<html></html>")
    routes = create_bidi_component_routes(_bidi_manager(str(comp_dir)), "")

    response = _client_for(routes).get("/_stcore/bidi-components/comp/index.html")

    assert response.status_code == 200
    assert response.headers["Cache-Control"] == "no-cache"


def test_bidi_component_options_returns_no_content() -> None:
    """The bidi component OPTIONS handler responds 204."""
    routes = create_bidi_component_routes(MagicMock(), "")
    response = _client_for(routes).options("/_stcore/bidi-components/comp/main.js")

    assert response.status_code == 204


def test_app_static_serves_existing_file(tmp_path: Path) -> None:
    """An existing app static file is served with permissive CORS/nosniff headers."""
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "data.txt").write_text("hello")
    routes = create_app_static_serving_routes(str(tmp_path / "app.py"), "")

    response = _client_for(routes).get("/app/static/data.txt")

    assert response.status_code == 200
    assert response.text == "hello"
    assert response.headers["Access-Control-Allow-Origin"] == "*"
    assert response.headers["X-Content-Type-Options"] == "nosniff"


def test_app_static_without_root_returns_404() -> None:
    """When no main script path is configured, app static requests yield 404."""
    routes = create_app_static_serving_routes(None, "")
    response = _client_for(routes).get("/app/static/data.txt")

    assert response.status_code == 404


def test_app_static_unsafe_path_returns_400(tmp_path: Path) -> None:
    """An app static path with an unsafe pattern is rejected with 400."""
    routes = create_app_static_serving_routes(str(tmp_path / "app.py"), "")
    endpoint = _endpoint_for(routes, "GET")

    with pytest.raises(HTTPException) as exc_info:
        asyncio.run(endpoint(_request_with_path("\x00bad")))

    assert exc_info.value.status_code == 400


def test_app_static_missing_file_returns_404(tmp_path: Path) -> None:
    """A request for a nonexistent app static file yields 404."""
    (tmp_path / "static").mkdir()
    routes = create_app_static_serving_routes(str(tmp_path / "app.py"), "")

    response = _client_for(routes).get("/app/static/missing.txt")

    assert response.status_code == 404


def test_app_static_oversized_file_returns_404(tmp_path: Path) -> None:
    """An app static file larger than the size limit yields 404."""
    static_dir = tmp_path / "static"
    static_dir.mkdir()
    (static_dir / "big.txt").write_text(string.digits)
    routes = create_app_static_serving_routes(str(tmp_path / "app.py"), "")

    with patch(
        "streamlit.web.server.starlette.starlette_routes.MAX_APP_STATIC_FILE_SIZE",
        5,
    ):
        response = _client_for(routes).get("/app/static/big.txt")

    assert response.status_code == 404


def test_app_static_options_advertises_allowed_methods(tmp_path: Path) -> None:
    """The app static OPTIONS handler responds 204 and advertises GET/OPTIONS."""
    routes = create_app_static_serving_routes(str(tmp_path / "app.py"), "")
    response = _client_for(routes).options("/app/static/data.txt")

    assert response.status_code == 204
    assert response.headers["Access-Control-Allow-Methods"] == "GET, OPTIONS"
