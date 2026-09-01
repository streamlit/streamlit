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

"""Playwright tests for @st.fragment(key=...) and st.rerun(scope=<key>)."""

import pytest
from playwright.sync_api import Page, expect

from e2e_playwright.shared.app_utils import (
    click_button,
    expect_exception,
    expect_no_exception,
    get_element_by_key,
)


@pytest.fixture(scope="module")
def app_server_extra_args() -> list[str]:
    return ["--runner.fastReruns=false"]


def _text(app: Page, key: str) -> str:
    """Return the text content of a container identified by its Streamlit key."""
    content = get_element_by_key(app, key).text_content()
    assert content is not None
    return content


def test_single_key_rerun_updates_only_fragment(app: Page) -> None:
    """Clicking a button whose on_click calls st.rerun('charts') reruns only the
    'charts' fragment; outside_counter does not increment.
    """
    initial_outside = _text(app, "outside_counter")
    initial_fragment_uuid = _text(app, "fragment_uuid")

    click_button(app, "Rerun charts fragment")

    # The fragment's content must have changed (new UUID).
    expect(get_element_by_key(app, "fragment_uuid")).not_to_have_text(
        initial_fragment_uuid
    )
    # The counter outside the fragment must not have changed (no full rerun).
    expect(get_element_by_key(app, "outside_counter")).to_have_text(initial_outside)

    expect_no_exception(app)


def test_multi_key_rerun_updates_both_fragments_not_outside(app: Page) -> None:
    """st.rerun(['frag_alpha', 'frag_beta']) reruns both fragments; stable text outside
    the fragments does not change.
    """
    initial_alpha = _text(app, "alpha_uuid")
    initial_beta = _text(app, "beta_uuid")
    initial_stable = _text(app, "stable_text")

    click_button(app, "Rerun alpha and beta")

    expect(get_element_by_key(app, "alpha_uuid")).not_to_have_text(initial_alpha)
    expect(get_element_by_key(app, "beta_uuid")).not_to_have_text(initial_beta)
    # Outside stable text must not change — no full rerun occurred.
    expect(get_element_by_key(app, "stable_text")).to_have_text(initial_stable)

    expect_no_exception(app)


def test_fragment_to_fragment_reruns_only_target(app: Page) -> None:
    """A button inside fragment A calling st.rerun('target_frag') reruns only
    the target fragment; the source fragment and outside text stay stable.
    """
    initial_source = _text(app, "source_uuid")
    initial_target = _text(app, "target_uuid")
    initial_stable = _text(app, "compose_stable_text")

    click_button(app, "Rerun target from source")

    # Only the target fragment must have rerun (new UUID).
    expect(get_element_by_key(app, "target_uuid")).not_to_have_text(initial_target)
    # Source fragment must NOT have rerun — targeted rerun replaces the default.
    expect(get_element_by_key(app, "source_uuid")).to_have_text(initial_source)
    # Outside text must not change — no full-app rerun occurred.
    expect(get_element_by_key(app, "compose_stable_text")).to_have_text(initial_stable)

    expect_no_exception(app)


def test_unknown_key_raises_visible_exception(app: Page) -> None:
    """st.rerun('nonexistent_key') raises StreamlitAPIException shown as an app error."""
    click_button(app, "Rerun unknown fragment")

    expect_exception(app, "No fragment found for target 'nonexistent_key'")


def test_fresh_input_coalesces_with_main_script_callback_replay(app: Page) -> None:
    app.get_by_label("Race name").fill("  Laura  ")
    app.get_by_role("button", name="Submit race form").click()
    expect(app.get_by_text("Form callback waiting for fresh input")).to_be_visible()

    app.get_by_role("button", name="Fresh interaction").click()

    expect(get_element_by_key(app, "race_results")).to_contain_text("Form callbacks: 1")
    expect(get_element_by_key(app, "race_results")).to_contain_text(
        "Fresh callbacks: 1"
    )
    expect(get_element_by_key(app, "race_results")).to_contain_text(
        "Normalized name: Laura"
    )
    expect(get_element_by_key(app, "race_results")).to_contain_text(
        "Body saw submit: True"
    )
    expect_no_exception(app)
