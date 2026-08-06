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

from e2e_playwright.shared.app_utils import get_element_by_key
from e2e_playwright.shared.skills_install_app import start_agent_home_app_server

if TYPE_CHECKING:
    from collections.abc import Generator

    from playwright.sync_api import Page

    from e2e_playwright.conftest import AsyncSubprocess, ImageCompareFunction


# Function-scoped (NOT module-scoped): the end-to-end test below performs a
# REAL install into this temp HOME. With a shared server, that install would
# leak into sibling tests/browsers landing on the same xdist worker — the server
# stops recommending the nudge, so a later test finds no toast/callout and fails.
# A fresh server + temp HOME per test keeps every test hermetic.
@pytest.fixture(autouse=True)
def app_server(
    app_port: int,
    request: pytest.FixtureRequest,
    tmp_path_factory: pytest.TempPathFactory,
) -> Generator[AsyncSubprocess, None, None]:
    """Start the app in a temp HOME (agent present, no skills), non-headless, so
    the server recommends the install — the precondition for the in-error
    callout. See ``start_agent_home_app_server`` for the shared isolation setup
    (also used by ``skills_nudge_test``).
    """
    proc = start_agent_home_app_server(
        app_port,
        request,
        tmp_path_factory,
        home_prefix="skills_callout_home",
        project_prefix="skills_callout_project",
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


def test_skills_install_callout_shows_below_one_error_box(
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

    # ...and it is its OWN box below the error, not a row inside it (per the
    # design), so `stException` still means just the error box.
    expect(app.get_by_test_id("stException").filter(has=callout)).to_have_count(0)

    # It attaches to the first Streamlit-raised error...
    expect(
        get_element_by_key(app, "streamlit_error_first").get_by_test_id(
            "stSkillsInstallCallout"
        )
    ).to_have_count(1)
    # ...and NOT to the plain ValueError, which renders first: installing skills
    # won't fix a bug in the developer's own logic. Because that box comes first,
    # this depends on the is_streamlit_exception gate, not on the single slot
    # already being claimed by a Streamlit error.
    expect(
        get_element_by_key(app, "user_error").get_by_test_id("stSkillsInstallCallout")
    ).to_have_count(0)

    # A single Install CTA — deliberately NOT dismissable: no ✕ / snooze /
    # "don't show again" on this surface.
    expect(callout.get_by_role("button", name="Install skills")).to_be_visible()
    expect(callout.get_by_role("button", name="Don't show again")).not_to_be_visible()
    expect(callout.get_by_role("button", name="Close")).not_to_be_visible()

    # Snapshot last so the functional assertions above aren't blocked by a
    # missing baseline (new snapshots get a Linux baseline via the autofix flow).
    assert_snapshot(callout, name="skills_install_callout-idle")
    # Also snapshot the error and its callout together: this is what the design
    # is about — two boxes sharing a tint and radius, the callout's sparkle
    # aligned with the exception type above it, and the error's own right-aligned
    # Copy / Ask Google / Ask ChatGPT links left undisturbed.
    assert_snapshot(
        get_element_by_key(app, "streamlit_error_first"),
        name="skills_install_callout-below_error_box",
    )


# The install flow is a backend operation (BackendOperationClient →
# InstallSkillsHandler) and is browser-agnostic, so exercise the real install
# once on chromium rather than redundantly across every browser.
@pytest.mark.only_browser("chromium")
def test_skills_install_callout_installs_end_to_end(
    app: Page, assert_snapshot: ImageCompareFunction
) -> None:
    """Clicking Install runs the real InstallSkillsHandler against the temp
    project and the callout confirms success — the full callout → backend →
    install chain, not a mock.

    Its function-scoped ``app_server`` gives it a fresh, skills-not-installed
    HOME, so the real install stays hermetic and can't suppress the nudge for
    any other test.
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
    # Snapshot the success confirmation (green check + text) while it's up, before
    # it auto-dismisses. Captured here rather than in the render test because only
    # this test drives a real install through to the success state.
    #
    # The failure state has no E2E coverage by construction, not by omission: the
    # server withholds the recommendation whenever an install would be blocked at
    # every target (``nudge_suppression_reason`` -> "conflict", via
    # ``_one_click_install_would_be_refused``), precisely so it never offers an
    # install that can only fail — and a conflict at only *some* targets installs
    # the rest and succeeds. What's left are races, write failures, and dropped
    # connections, none of which a test can force deterministically here. The error
    # UI is covered by the SkillsInstallCallout unit test instead; the spec carries
    # a render of it.
    assert_snapshot(callout, name="skills_install_callout-success")
