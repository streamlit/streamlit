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

import shutil
from types import SimpleNamespace
from typing import TYPE_CHECKING

import pytest
from playwright.sync_api import expect

from e2e_playwright.conftest import (
    start_app_server,
    wait_for_app_loaded,
)

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

    The app script is copied into an ISOLATED temp project dir (its own tree:
    no ``.git``, no ``.agents``/``.claude``, no installed skills) and run from
    there. The nudge's skill detection scans the app's directory, its git root,
    and the nearest agent-config ancestor — so running the script in place would
    make this test depend on the developer's real checkout (e.g. flake/fail for
    anyone who has the bundled skill installed in this repo). Isolation keeps
    the only "agent present, no skills" signal coming from the temp HOME.
    """
    home = tmp_path_factory.mktemp("skills_nudge_home")
    # An agent harness is considered "present" when its home config dir exists.
    (home / ".claude").mkdir()
    # Pre-seed empty credentials so non-headless startup never prompts.
    streamlit_dir = home / ".streamlit"
    streamlit_dir.mkdir()
    (streamlit_dir / "credentials.toml").write_text('[general]\nemail = ""\n')

    # Copy the app script into an isolated project dir and point a shim module
    # at it; start_app_server resolves the script purely from ``__file__``.
    project = tmp_path_factory.mktemp("skills_nudge_project")
    assert request.module.__file__ is not None
    source_script = request.module.__file__.replace("_test.py", ".py")
    shutil.copy(source_script, project / "skills_nudge.py")
    isolated_module = SimpleNamespace(__file__=str(project / "skills_nudge_test.py"))

    proc = start_app_server(
        app_port,
        isolated_module,  # type: ignore[arg-type]
        # Appended last so they override the headless default in conftest.
        extra_args=["--server.headless", "false"],
        extra_env={"HOME": str(home)},
    )
    yield proc
    print(proc.terminate(), flush=True)


def test_skills_nudge_shows_and_dismisses(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """The nudge appears in local dev with an agent but no skills, coexists with
    app toasts, can be permanently dismissed, and stays gone after a reload.
    """
    nudge = app.get_by_test_id("stSkillsNudge")
    expect(nudge).to_be_visible()
    expect(nudge).to_contain_text("Help agents write better Streamlit")
    expect(nudge.get_by_role("button", name="Install")).to_be_visible()
    expect(nudge.get_by_role("button", name="Don't show again")).to_be_visible()
    # The close (✕) control exposes an accessible "Close" name (it snoozes the
    # nudge rather than permanently dismissing it — that's the text link).
    expect(nudge.get_by_role("button", name="Close")).to_be_visible()

    # Snapshot the idle toast before any interaction mutates its state.
    assert_snapshot(nudge, name="skills_nudge-idle")

    # The nudge coexists with regular app toasts: firing an st.toast must not
    # displace or hide the persistent nudge. Trigger one from the app script.
    app.get_by_role("button", name="Show toast").click()
    toast = app.get_by_test_id("stToast").filter(has_text="App toast message")
    expect(toast).to_be_visible()
    # The nudge is still there alongside the app toast (it is not replaced).
    expect(nudge).to_be_visible()

    # The toast must be positioned (top-right, beneath the pinned nudge), not
    # rendered unpositioned at the document origin. The nudge is a standalone
    # fixed card and the app pushes the toast region down by the nudge's
    # measured height, so app toasts stack beneath it. Assert the toast sits to
    # the right and below the nudge's top edge.
    nudge_box = nudge.bounding_box()
    toast_box = toast.bounding_box()
    assert nudge_box is not None
    assert toast_box is not None
    # Toast stacks below the nudge's top and shares the right-aligned column.
    assert toast_box["y"] >= nudge_box["y"], (
        f"toast (y={toast_box['y']}) should not sit above the nudge "
        f"(y={nudge_box['y']})"
    )
    # Both the nudge and app toasts are pinned to the same fixed right edge, so
    # their right edges line up (allowing a small sub-pixel rounding tolerance).
    # This verifies the toast is positioned in the pinned right column, not
    # rendered unpositioned at the document origin (x≈0).
    nudge_right = nudge_box["x"] + nudge_box["width"]
    toast_right = toast_box["x"] + toast_box["width"]
    assert abs(toast_right - nudge_right) <= 2, (
        f"toast right edge ({toast_right}) should align with the nudge's "
        f"({nudge_right}) — both pinned to the same right column"
    )

    # The app toast auto-dismisses on its own timer; the nudge persists (it
    # never fades on a timer — only an explicit action dismisses it).
    expect(toast).not_to_be_visible(timeout=10000)
    expect(nudge).to_be_visible()

    # Permanently dismiss; the nudge disappears immediately.
    nudge.get_by_role("button", name="Don't show again").click()
    expect(nudge).not_to_be_visible()

    # After a reload it stays gone: the localStorage flag and the server-side
    # marker (written into the temp HOME) both suppress it.
    app.reload()
    wait_for_app_loaded(app)
    expect(app.get_by_test_id("stSkillsNudge")).not_to_be_visible()
