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
from e2e_playwright.shared.app_utils import get_button, get_markdown

if TYPE_CHECKING:
    from collections.abc import Generator

AUTH_SECRETS_TEMPLATE = """
[auth]
redirect_uri = "http://localhost:{app_port}/oauth2callback"
cookie_secret = "your_cookie_secret_here"

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
def app_server_extra_args(prepare_secrets_file: str) -> list[str]:
    """Fixture that returns extra arguments to pass to the Streamlit app server."""
    return [
        "--secrets.files",
        prepare_secrets_file,
    ]


@pytest.mark.parametrize("fake_oidc_server", ["success"], indirect=True)
@pytest.mark.usefixtures("fake_oidc_server", "prepare_secrets_file")
def test_login_successful(app: Page):
    """Test authentication flow with test provider."""
    button_element = get_button(app, "TEST LOGIN")
    button_element.click()
    app.wait_for_timeout(2_000)

    text = get_markdown(app, "authtest@example.com")
    expect(text).to_be_visible()
    wait_for_app_run(app)

    text = get_markdown(app, "John Doe")
    expect(text).to_be_visible()


@pytest.mark.parametrize("fake_oidc_server", ["failure"], indirect=True)
@pytest.mark.usefixtures("fake_oidc_server", "prepare_secrets_file")
def test_login_failure(app: Page):
    """Test authentication flow with error response from oidc server."""
    button_element = get_button(app, "TEST LOGIN")
    button_element.click()
    app.wait_for_timeout(2_000)
    wait_for_app_run(app)

    text = app.get_by_test_id("stMarkdownContainer").filter(has_text="John Doe")
    expect(text).not_to_be_attached()
