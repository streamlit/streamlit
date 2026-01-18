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
from playwright.sync_api import Page, expect

from e2e_playwright.conftest import (
    AsyncSubprocess,
    find_available_port,
    wait_for_app_run,
)
from e2e_playwright.shared.app_utils import expect_markdown, get_button

if TYPE_CHECKING:
    from collections.abc import Generator

AUTH_SECRETS_TEMPLATE = """
[auth]
redirect_uri = "http://localhost:{app_port}/oauth2callback"
cookie_secret = "your_cookie_secret_here"
expose_tokens = ["id", "access"]

[auth.testprovider]
client_id = "test-client-id"
client_secret = "test-client-secret"
server_metadata_url = "http://localhost:{oidc_server_port}/.well-known/openid-configuration"
"""


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
    time.sleep(1)
    yield oidc_server_proc
    oidc_server_stdout = oidc_server_proc.terminate()
    print(oidc_server_stdout, flush=True)


@pytest.fixture(scope="module")
def prepare_secrets_file(app_port: int, oidc_server_port: int):
    """Fixture that inject the correct port to auth_secrets.toml file redirect_uri."""
    # Read in the file
    rendered_secrets = AUTH_SECRETS_TEMPLATE.format(
        app_port=app_port, oidc_server_port=oidc_server_port
    )
    with NamedTemporaryFile(suffix=".toml", delete=False) as tmp_secrets_file:
        tmp_secrets_file.write(rendered_secrets.encode())
        tmp_secrets_file.flush()
        yield tmp_secrets_file.name


@pytest.fixture(scope="module")
def app_server_extra_args(
    prepare_secrets_file: str, request: pytest.FixtureRequest
) -> list[str]:
    """Fixture that returns extra arguments to pass to the Streamlit app server."""
    args = [
        "--secrets.files",
        prepare_secrets_file,
    ]
    if request.config.getoption("--use-starlette"):
        args.extend(["--server.useStarlette", "true"])
    return args


def _click_and_wait_for_oauth_redirect(
    app: Page, button_label: str, app_port: int
) -> None:
    """Click a button that triggers OAuth redirect and wait for navigation back to app.

    OAuth login/logout triggers external redirects (app -> OIDC server -> app).
    We wait for the URL to return to the app root instead of using a fixed timeout.
    """
    get_button(app, button_label).click()
    # Wait for OAuth redirect chain to complete and return to app root
    app.wait_for_url(f"http://localhost:{app_port}/")
    wait_for_app_run(app)


@pytest.mark.parametrize("fake_oidc_server", ["success"], indirect=True)
@pytest.mark.usefixtures("fake_oidc_server", "prepare_secrets_file")
def test_login_successful(app: Page, app_port: int):
    """Test authentication flow with test provider."""
    _click_and_wait_for_oauth_redirect(app, "TEST LOGIN", app_port)

    expect_markdown(app, "authtest@example.com")

    expect_markdown(app, "John Doe")
    expect_markdown(app, "TOKENS AVAILABLE")
    expect_markdown(app, "HAS ID TOKEN")
    expect_markdown(app, "HAS ACCESS TOKEN")


@pytest.mark.parametrize("fake_oidc_server", ["failure"], indirect=True)
@pytest.mark.usefixtures("fake_oidc_server", "prepare_secrets_file")
def test_login_failure(app: Page, app_port: int):
    """Test authentication flow with error response from oidc server."""
    _click_and_wait_for_oauth_redirect(app, "TEST LOGIN", app_port)

    text = app.get_by_test_id("stMarkdownContainer").filter(has_text="John Doe")
    expect(text).not_to_be_attached()


@pytest.mark.parametrize("fake_oidc_server", ["success"], indirect=True)
@pytest.mark.usefixtures("fake_oidc_server", "prepare_secrets_file")
def test_logout_with_end_session_endpoint(app: Page, app_port: int):
    """Test logout flow using OIDC end_session_endpoint.

    This tests PR #12693: logout should redirect to provider's end_session_endpoint.
    """
    # First login
    _click_and_wait_for_oauth_redirect(app, "TEST LOGIN", app_port)

    # Verify we're logged in
    expect_markdown(app, "YOU ARE LOGGED IN")
    expect_markdown(app, "John Doe")

    # Now logout (also goes through OIDC end_session_endpoint redirect)
    _click_and_wait_for_oauth_redirect(app, "TEST LOGOUT", app_port)

    # Verify we're logged out
    expect_markdown(app, "NOT LOGGED IN")
    # Verify the logged-in content is no longer visible
    logged_in_text = app.get_by_test_id("stMarkdownContainer").filter(
        has_text="YOU ARE LOGGED IN"
    )
    expect(logged_in_text).not_to_be_attached()
