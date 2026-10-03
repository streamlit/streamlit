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

import time
from tempfile import NamedTemporaryFile
from typing import TYPE_CHECKING

import pytest
import requests
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    AsyncSubprocess,
    build_app_url,
    find_available_port,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import expect_markdown, get_button

if TYPE_CHECKING:
    from collections.abc import Generator

# Compared to auth_test.py, this template adds a ``logout_params`` table under
# ``[auth]`` so the OIDC logout URL is customized: it adds ``logout_hint``
# (substituted from the ``email`` claim), removes ``id_token_hint``, and keeps
# ``post_logout_redirect_uri`` so the mock server still redirects back and the
# logout flow completes.
AUTH_SECRETS_TEMPLATE = """
[auth]
redirect_uri = "{redirect_uri}"
cookie_secret = "your_cookie_secret_here"
expose_tokens = ["id", "access"]
logout_params = {{ logout_hint = "{{email}}", id_token_hint = "" }}

[auth.testprovider]
client_id = "test-client-id"
client_secret = "test-client-secret"
server_metadata_url = "{server_metadata_url}"
"""


def wait_for_oidc_server_to_start(port: int, timeout: int = 60) -> bool:
    """Wait for the OIDC mock server to start.

    Parameters
    ----------
    port : int
        The port on which the OIDC server is running.
    timeout : int
        The number of seconds to wait for the server to start.

    Returns
    -------
    bool
        True if the server started successfully, False otherwise.
    """
    print(f"Waiting for OIDC server to start on port {port}...")
    start_time = time.time()
    url = f"http://localhost:{port}/.well-known/openid-configuration"
    while time.time() - start_time < timeout:
        try:
            response = requests.get(url, timeout=1)
            if response.status_code == 200:
                return True
        except requests.RequestException:
            # Connection errors are expected while the mock server is starting
            pass
        time.sleep(0.5)
    return False


@pytest.fixture(scope="module")
def oidc_server_port() -> int:
    """Fixture that returns the port of the OIDC server."""
    return find_available_port()


@pytest.fixture(scope="module")
def fake_oidc_server(
    request: pytest.FixtureRequest, oidc_server_port: int
) -> Generator[AsyncSubprocess, None, None]:
    """Fixture that starts and stops the OIDC app server."""

    is_success = getattr(request, "param", "success")

    oidc_server_proc = AsyncSubprocess(
        [
            "python",
            "shared/oidc_mock_server.py",
            "--port",
            str(oidc_server_port),
            "--success" if is_success == "success" else "--failure",
        ],
        cwd=".",
    )

    oidc_server_proc.start()
    if not wait_for_oidc_server_to_start(oidc_server_port):
        oidc_server_proc.terminate()
        raise RuntimeError(
            f"OIDC mock server failed to start on port {oidc_server_port}"
        )
    yield oidc_server_proc
    oidc_server_stdout = oidc_server_proc.terminate()
    print(oidc_server_stdout, flush=True)


@pytest.fixture(scope="module")
def prepare_secrets_file(
    app_base_url: str, oidc_server_port: int
) -> Generator[str, None, None]:
    """Create a temporary auth secrets TOML with correct redirect/provider URLs."""
    redirect_uri = build_app_url(app_base_url, path="/oauth2callback")
    server_metadata_url = build_app_url(
        f"http://localhost:{oidc_server_port}", path="/.well-known/openid-configuration"
    )
    rendered_secrets = AUTH_SECRETS_TEMPLATE.format(
        redirect_uri=redirect_uri, server_metadata_url=server_metadata_url
    )
    with NamedTemporaryFile(suffix=".toml", delete=False) as tmp_secrets_file:
        tmp_secrets_file.write(rendered_secrets.encode())
        tmp_secrets_file.flush()
        yield tmp_secrets_file.name


@pytest.fixture(scope="module")
def app_server_extra_args(prepare_secrets_file: str) -> list[str]:
    """Fixture that returns extra arguments to pass to the Streamlit app server."""
    return [
        "--secrets.files",
        prepare_secrets_file,
    ]


def _click_and_wait_for_oauth_redirect(
    app: Page, button_label: str, app_base_url: str
) -> None:
    """Click a button that triggers OAuth redirect and wait for navigation back to app.

    OAuth login/logout triggers external redirects (app -> OIDC server -> app).
    We wait for the URL to return to the app root instead of using a fixed timeout.
    """
    get_button(app, button_label).click()
    # Wait for OAuth redirect chain to complete and return to app root
    app.wait_for_url(build_app_url(app_base_url, path="/"))
    wait_for_app_run(app)


@pytest.mark.parametrize("fake_oidc_server", ["success"], indirect=True)
@pytest.mark.usefixtures("fake_oidc_server", "prepare_secrets_file")
def test_logout_applies_logout_params(
    app: Page, app_base_url: str, oidc_server_port: int
) -> None:
    """Test that auth.logout_params customizes the OIDC logout URL.

    Verifies that ``logout_params`` adds ``logout_hint`` (substituted from the
    ``email`` claim), removes ``id_token_hint``, and keeps
    ``post_logout_redirect_uri`` on the redirect to the provider's
    ``end_session_endpoint``.
    """
    # Log in first.
    _click_and_wait_for_oauth_redirect(app, "TEST LOGIN", app_base_url)
    expect_markdown(app, "YOU ARE LOGGED IN: authtest@example.com")

    # Log out (redirects app -> /auth/logout -> provider /logout -> app). The
    # provider /logout hop is reached via a server-side redirect chain, so we
    # read the captured query params from the mock server instead of trying to
    # intercept the cross-origin navigation.
    _click_and_wait_for_oauth_redirect(app, "TEST LOGOUT", app_base_url)

    logout_info = app.request.get(f"http://localhost:{oidc_server_port}/logout-info")
    assert logout_info.ok, "failed to read logout info from mock server"
    logout_params = logout_info.json().get("params", {})
    # logout_hint is added and substituted from the email claim.
    assert logout_params.get("logout_hint") == "authtest@example.com"
    # id_token_hint is removed via an empty-string logout_params value.
    assert "id_token_hint" not in logout_params
    # The untouched default param is still present.
    assert "post_logout_redirect_uri" in logout_params

    # The app returns to the logged-out state.
    expect_markdown(app, "NOT LOGGED IN")
    logged_in_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text="YOU ARE LOGGED IN"
    )
    expect(logged_in_text).not_to_be_attached()
