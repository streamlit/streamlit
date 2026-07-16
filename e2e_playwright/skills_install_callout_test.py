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

from e2e_playwright.conftest import start_app_server

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
    Streamlit skills are installed, and non-headless, so the server recommends
    the install — the precondition for the in-error callout to show.

    Mirrors the ``skills_nudge_test`` setup: the app is copied into an ISOLATED
    temp project dir (no ``.git`` / ``.agents`` / ``.claude`` / skills of its
    own) and run from there, so the "agent present, no skills" signal comes only
    from the temp HOME and never depends on the developer's real checkout.
    """
    home = tmp_path_factory.mktemp("skills_callout_home")
    # An agent harness is considered "present" when its home config dir exists.
    (home / ".claude").mkdir()
    # Pre-seed empty credentials so non-headless startup never prompts.
    streamlit_dir = home / ".streamlit"
    streamlit_dir.mkdir()
    (streamlit_dir / "credentials.toml").write_text('[general]\nemail = ""\n')

    project = tmp_path_factory.mktemp("skills_callout_project")
    assert request.module.__file__ is not None
    source_script = request.module.__file__.replace("_test.py", ".py")
    shutil.copy(source_script, project / "skills_install_callout.py")
    isolated_module = SimpleNamespace(
        __file__=str(project / "skills_install_callout_test.py")
    )

    proc = start_app_server(
        app_port,
        isolated_module,  # type: ignore[arg-type]
        # Appended last so they override the headless default in conftest.
        extra_args=["--server.headless", "false"],
        extra_env={"HOME": str(home)},
    )
    yield proc
    print(proc.terminate(), flush=True)


def _dismiss_proactive_toast(app: Page) -> None:
    """Dismiss the proactive nudge toast so the in-error callout can appear.

    The two surfaces are mutually exclusive — the callout only shows once the
    toast is gone. The toast's ✕ also snoozes it for ~24h, but the callout
    intentionally ignores that snooze (an error is a higher-intent moment than a
    snoozed proactive nudge).
    """
    toast = app.get_by_test_id("stSkillsNudge")
    expect(toast).to_be_visible()
    toast.get_by_role("button", name="Close").click()
    expect(toast).not_to_be_visible()


def test_skills_install_callout_shows_in_one_error_box(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """In local dev (agent present, no skills) the in-error callout appears once
    the proactive toast is dismissed (the two are mutually exclusive), is a
    single non-dismissable Install CTA scoped to Streamlit-raised errors, and is
    deduped to one even with several eligible errors on screen.
    """
    # Mutual exclusion: while the proactive toast is up, the callout is
    # suppressed — even though eligible errors are already on screen.
    expect(app.get_by_test_id("stSkillsNudge")).to_be_visible()
    expect(app.get_by_test_id("stException")).to_have_count(3)
    expect(app.get_by_test_id("stSkillsInstallCallout")).to_have_count(0)

    # Dismiss the toast; the callout then takes over.
    _dismiss_proactive_toast(app)

    # Deduped to exactly one (the first eligible error box claims the single
    # shared slot)...
    callout = app.get_by_test_id("stSkillsInstallCallout")
    expect(callout).to_have_count(1)
    expect(callout).to_be_visible()

    # ...and it sits inside an error box, not floating elsewhere on the page.
    expect(app.get_by_test_id("stException").filter(has=callout)).to_have_count(1)

    # Scoping: the plain (non-Streamlit) ValueError box gets NO callout —
    # installing skills won't fix a bug in the developer's own logic.
    expect(
        app.get_by_test_id("stException")
        .filter(has_text="user-code error")
        .get_by_test_id("stSkillsInstallCallout")
    ).to_have_count(0)

    # A single Install CTA — deliberately NOT dismissable: no ✕ / snooze /
    # "don't show again" on this surface.
    expect(callout.get_by_role("button", name="Install skills")).to_be_visible()
    expect(callout.get_by_role("button", name="Don't show again")).not_to_be_visible()
    expect(callout.get_by_role("button", name="Close")).not_to_be_visible()

    # Snapshot last so the functional assertions above aren't blocked by a
    # missing baseline (new snapshots get a Linux baseline via the autofix flow).
    assert_snapshot(callout, name="skills_install_callout-idle")


def test_skills_install_callout_installs_end_to_end(app: Page) -> None:
    """Clicking Install runs the real InstallSkillsHandler against the temp
    project and the callout confirms success — the full callout → backend →
    install chain, not a mock.

    Runs after the render test (and mutates the temp project by installing the
    skills), so it is intentionally the last test in this module.
    """
    # Dismiss the proactive toast so the mutually-exclusive callout appears.
    _dismiss_proactive_toast(app)

    callout = app.get_by_test_id("stSkillsInstallCallout")
    expect(callout).to_be_visible()

    # One click → the real installer runs and the callout confirms success.
    # (The success confirmation is transient — it auto-dismisses — but the
    # install is a fast local symlink, so it's observable well within that.)
    callout.get_by_role("button", name="Install skills").click()
    expect(callout.get_by_text("Skills installed", exact=False)).to_be_visible(
        timeout=30000
    )
