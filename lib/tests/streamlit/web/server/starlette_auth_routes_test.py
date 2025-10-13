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

from http.cookies import SimpleCookie
from typing import TYPE_CHECKING, Any

import pytest
from starlette.applications import Starlette
from starlette.responses import PlainTextResponse
from starlette.testclient import TestClient
from tornado.web import decode_signed_value

from streamlit.web.server import starlette_auth_routes
from streamlit.web.server.starlette_auth_routes import get_auth_routes
from tests.testutil import patch_config_options

if TYPE_CHECKING:
    import pytest


class _NoAuthlibRuntimeError(RuntimeError):
    pass


def _build_app() -> Starlette:
    app = Starlette(routes=get_auth_routes(""))

    @app.route("/", methods=["GET"])  # type: ignore[arg-type]
    async def root(_: Any) -> PlainTextResponse:
        return PlainTextResponse("ok")

    return app


def test_redirect_without_provider(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("STREAMLIT_OAUTH_PROVIDER", "")
    with TestClient(_build_app()) as client:
        response = client.get("/auth/login")
        assert response.status_code == 200
        assert response.text == "ok"


def test_logout_clears_cookie() -> None:
    with TestClient(_build_app()) as client:
        client.cookies.set("_streamlit_user", "value")
        response = client.get("/auth/logout", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers.get("set-cookie")
        follow_up = client.get(response.headers["location"])  # follow redirect manually
        assert follow_up.status_code == 200


def test_callback_handles_error_query(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: "http://testserver",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: "default",
    )

    app = Starlette(routes=get_auth_routes(""))
    with TestClient(app) as client:
        response = client.get(
            "/oauth2callback?state=abc&error=access_denied&error_description=nope",
            follow_redirects=False,
        )
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")


def test_callback_missing_provider_redirects(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: "http://testserver",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: None,
    )

    app = Starlette(routes=get_auth_routes(""))
    with TestClient(app) as client:
        response = client.get("/oauth2callback?state=abc", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")


@patch_config_options({"server.cookieSecret": "test-secret"})
def test_auth_callback_sets_signed_cookie(monkeypatch: pytest.MonkeyPatch) -> None:
    async def _dummy_authorize_access_token(self, request: Any) -> dict[str, Any]:
        return {"userinfo": {"email": "user@example.com"}}

    class _DummyClient:
        async def authorize_access_token(self, request: Any) -> dict[str, Any]:
            return await _dummy_authorize_access_token(self, request)

    monkeypatch.setattr(
        starlette_auth_routes,
        "_create_oauth_client",
        lambda provider: (_DummyClient(), "/redirect"),
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_provider_by_state",
        lambda state: "default",
    )
    monkeypatch.setattr(
        starlette_auth_routes,
        "_get_origin_from_secrets",
        lambda: "http://testserver",
    )

    app = Starlette(routes=get_auth_routes(""))
    with TestClient(app) as client:
        response = client.get("/oauth2callback?state=abc", follow_redirects=False)
        assert response.status_code == 302
        assert response.headers["location"].endswith("/")

        cookies = SimpleCookie()
        cookies.load(response.headers["set-cookie"])
        signed_value = cookies["_streamlit_user"].value
        decoded = decode_signed_value("test-secret", "_streamlit_user", signed_value)
        assert decoded is not None
        payload = decoded.decode("utf-8")
        assert "user@example.com" in payload
        assert '"is_logged_in": true' in payload.lower()
