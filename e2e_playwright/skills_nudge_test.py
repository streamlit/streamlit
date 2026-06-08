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

from typing import TYPE_CHECKING

import pytest
from playwright.sync_api import expect

from e2e_playwright.conftest import start_app_server, wait_for_app_loaded

if TYPE_CHECKING:
    from collections.abc import Generator

    from playwright.sync_api import Page

    from e2e_playwright.conftest import AsyncSubprocess, ImageCompareFunction


@pytest.fixture(scope="module", autouse=True)
def app_server(
    app_port: int,
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
) -> Generator[AsyncSubprocess, None, None]:
    """Start the app with a temp HOME where an agent harness is present but no
    Streamlit skills are installed, and with the welcome message enabled
    (non-headless), so the server recommends the install-skills nudge.

    This overrides the default ``app_server`` fixture from ``conftest`` so the
    nudge gating is deterministic regardless of the developer's / CI's real
    home directory.
    """
    home = tmp_path_factory.mktemp("skills_nudge_home")
    # An agent harness is considered "present" when its home config dir exists.
    (home / ".claude").mkdir()
    # Pre-seed empty credentials so non-headless startup never prompts.
    streamlit_dir = home / ".streamlit"
    streamlit_dir.mkdir()
    (streamlit_dir / "credentials.toml").write_text('[general]\nemail = ""\n')

    proc = start_app_server(
        app_port,
        request.module,
        # Appended last so they override the headless default in conftest.
        extra_args=["--server.headless", "false"],
        extra_env={"HOME": str(home)},
    )
    yield proc
    print(proc.terminate(), flush=True)


def test_skills_nudge_shows_and_dismisses(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """The nudge appears in local dev with an agent but no skills, can be
    permanently dismissed, and stays gone after a reload.
    """
    nudge = app.get_by_test_id("stSkillsNudge")
    expect(nudge).to_be_visible()
    expect(nudge).to_contain_text("Help agents write better Streamlit apps")
    expect(nudge.get_by_role("button", name="Install")).to_be_visible()
    expect(nudge.get_by_role("button", name="Don't show again")).to_be_visible()
    # The close (✕) control exposes an accessible "Dismiss" name.
    expect(nudge.get_by_role("button", name="Dismiss")).to_be_visible()

    assert_snapshot(nudge, name="skills_nudge-default")

    # Permanently dismiss; the toast disappears immediately.
    nudge.get_by_role("button", name="Don't show again").click()
    expect(nudge).not_to_be_visible()

    # After a reload it stays gone: the localStorage flag and the server-side
    # marker (written into the temp HOME) both suppress it.
    app.reload()
    wait_for_app_loaded(app)
    expect(app.get_by_test_id("stSkillsNudge")).not_to_be_visible()
