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

"""E2E tests for parallel fragments feature."""

from __future__ import annotations

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import build_app_url, wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, get_element_by_key

# =============================================================================
# Core parallel fragment tests (use `app` fixture - auto-navigates to default mode)
# =============================================================================


def test_parallel_fragments_render_concurrently(app: Page) -> None:
    """3 fragments with staggered sleep times all render within parallel time budget.

    Sequential execution would take ~0.6s (0.3+0.2+0.1).
    Parallel execution should complete in ~0.3s (max sleep time).
    We verify dispatch time is < 0.5s to confirm parallelism.
    """
    expect(app.get_by_text("Fragment 1 done")).to_be_visible()
    expect(app.get_by_text("Fragment 2 done")).to_be_visible()
    expect(app.get_by_text("Fragment 3 done")).to_be_visible()
    expect(app.get_by_text("All fragments dispatched")).to_be_visible()

    dispatch_time_text = app.get_by_text(re.compile(r"Dispatch time: \d+\.\d+s"))
    expect(dispatch_time_text).to_be_visible()
    text_content = dispatch_time_text.text_content()
    assert text_content is not None
    match = re.search(r"Dispatch time: (\d+\.\d+)s", text_content)
    assert match is not None, f"Could not parse dispatch time from: {text_content}"
    dispatch_time = float(match.group(1))
    assert dispatch_time < 0.5, (
        f"Dispatch time {dispatch_time}s >= 0.5s suggests sequential execution"
    )


def test_parallel_fragment_widget_interaction(app: Page) -> None:
    """Button in parallel fragment, click triggers sequential rerun."""
    expect(app.get_by_text("Counter: 0", exact=True)).to_be_visible()

    click_button(app, "Click me")
    wait_for_app_run(app)

    expect(app.get_by_text("Counter: 1", exact=True)).to_be_visible()


def test_parallel_fragment_rerun_only_reruns_self(app: Page) -> None:
    """Click in fragment A doesn't rerun fragment B."""
    expect(app.get_by_text("Fragment A ran 1 times")).to_be_visible()
    expect(app.get_by_text("Fragment B ran 1 times")).to_be_visible()

    click_button(app, "Rerun A")
    wait_for_app_run(app)

    expect(app.get_by_text("Fragment A ran 2 times")).to_be_visible()
    expect(app.get_by_text("Fragment B ran 1 times")).to_be_visible()


def test_parallel_fragments_preserve_source_order(app: Page) -> None:
    """Fragments render in DOM order matching declaration order.

    Despite Fragment 3 finishing first (0.1s sleep), Fragment 1 finishing last (0.3s),
    the DOM order should match the source declaration order: 1, 2, 3.
    """
    frag1 = app.get_by_text("Fragment 1 done", exact=True)
    frag2 = app.get_by_text("Fragment 2 done", exact=True)
    frag3 = app.get_by_text("Fragment 3 done", exact=True)

    expect(frag1).to_be_visible()
    expect(frag2).to_be_visible()
    expect(frag3).to_be_visible()

    box1 = frag1.bounding_box()
    box2 = frag2.bounding_box()
    box3 = frag3.bounding_box()

    assert box1 is not None
    assert box2 is not None
    assert box3 is not None
    assert box1["y"] < box2["y"], "Fragment 1 should be above Fragment 2"
    assert box2["y"] < box3["y"], "Fragment 2 should be above Fragment 3"


def test_parallel_fragment_container_matches_main_thread(app: Page) -> None:
    """Verify container pre-allocation: no duplicate or empty containers.

    The fragment's content should appear in exactly one container, with no
    empty sibling containers from duplicate st.container() calls.
    """
    container_section = get_element_by_key(app, "container_test_section")

    expect(container_section.get_by_text("Container test content")).to_be_visible()

    content_elements = container_section.get_by_text(
        "Container test content", exact=True
    )
    expect(content_elements).to_have_count(1)

    vertical_blocks = container_section.get_by_test_id("stVerticalBlock")
    for i in range(vertical_blocks.count()):
        block = vertical_blocks.nth(i)
        inner_text = block.inner_text()
        assert inner_text.strip() != "", f"Found empty container at index {i}"


# =============================================================================
# API Restrictions tests (use `page` + `app_base_url` fixtures for explicit navigation)
# =============================================================================


def test_parallel_fragment_blocks_dialog_during_initial_run(
    page: Page, app_base_url: str
) -> None:
    """Parallel fragment unconditionally calling @st.dialog shows error."""
    page.goto(build_app_url(app_base_url, query="test=dialog_block"))
    wait_for_app_run(page)

    exception_message = page.get_by_test_id("stExceptionMessage")
    expect(exception_message).to_be_visible()
    expect(exception_message).to_contain_text(
        "cannot be called from a parallel fragment"
    )
    expect(exception_message).to_contain_text("@st.dialog")


def test_parallel_fragment_blocks_switch_page_during_initial_run(
    page: Page, app_base_url: str
) -> None:
    """Parallel fragment calling st.switch_page shows error."""
    page.goto(build_app_url(app_base_url, query="test=switch_page_block"))
    wait_for_app_run(page)

    exception_message = page.get_by_test_id("stExceptionMessage")
    expect(exception_message).to_be_visible()
    expect(exception_message).to_contain_text(
        "cannot be called from a parallel fragment"
    )
    expect(exception_message).to_contain_text("st.switch_page")


def test_parallel_fragment_allows_dialog_on_rerun(
    page: Page, app_base_url: str
) -> None:
    """Parallel fragment allows dialog when triggered by button click."""
    page.goto(build_app_url(app_base_url, query="test=dialog_allow_rerun"))
    wait_for_app_run(page)

    expect(page.get_by_text("Fragment content")).to_be_visible()

    click_button(page, "Open Dialog")
    wait_for_app_run(page)

    expect(page.get_by_text("Dialog opened successfully")).to_be_visible()


def test_nested_sequential_fragment_blocks_dialog_during_parallel_batch(
    page: Page, app_base_url: str
) -> None:
    """Non-parallel fragment nested inside parallel fragment inherits restriction."""
    page.goto(build_app_url(app_base_url, query="test=nested_sequential_block"))
    wait_for_app_run(page)

    # There may be multiple exception messages (original + wrapped), use first()
    exception_message = page.get_by_test_id("stExceptionMessage").first
    expect(exception_message).to_be_visible()
    expect(exception_message).to_contain_text(
        "cannot be called from a parallel fragment"
    )


def test_nested_parallel_fragments_both_restricted(
    page: Page, app_base_url: str
) -> None:
    """Parallel fragment nested inside parallel fragment is also restricted."""
    page.goto(build_app_url(app_base_url, query="test=nested_parallel_block"))
    wait_for_app_run(page)

    exception_message = page.get_by_test_id("stExceptionMessage")
    expect(exception_message).to_be_visible()
    expect(exception_message).to_contain_text(
        "cannot be called from a parallel fragment"
    )


def test_nested_parallel_fragment_allows_dialog_on_rerun(
    page: Page, app_base_url: str
) -> None:
    """Nested parallel fragment allows dialog on rerun."""
    page.goto(build_app_url(app_base_url, query="test=nested_parallel_allow_rerun"))
    wait_for_app_run(page)

    expect(page.get_by_text("Inner fragment")).to_be_visible()

    click_button(page, "Open Nested Dialog")
    wait_for_app_run(page)

    expect(page.get_by_text("Nested dialog opened successfully")).to_be_visible()


# =============================================================================
# Cancellation tests (use `page` + `app_base_url` fixtures for explicit navigation)
# =============================================================================


def test_parallel_st_stop_ends_script(page: Page, app_base_url: str) -> None:
    """Fragment A calls st.stop, should end quickly without waiting for Fragment B."""
    page.goto(build_app_url(app_base_url, query="test=st_stop"))
    wait_for_app_run(page)

    expect(page.get_by_text("Fragment A content")).to_be_visible()
    # Fragment B should not complete due to st.stop in Fragment A
    expect(page.get_by_text("Fragment B done after 5s")).not_to_be_visible()

    total_time_text = page.get_by_text(re.compile(r"Total time: \d+\.\d+s"))
    expect(total_time_text).to_be_visible()


def test_parallel_st_rerun_restarts_app(page: Page, app_base_url: str) -> None:
    """Fragment calls st.rerun on first run, app restarts."""
    page.goto(build_app_url(app_base_url, query="test=st_rerun"))
    wait_for_app_run(page)

    expect(page.get_by_text("App restarted successfully")).to_be_visible()
    # Run 1: run_count starts at 0, incremented to 1, fragment sets to 2 and reruns
    # Run 2: run_count is 2, incremented to 3, fragment shows success
    expect(page.get_by_text("Run count: 3", exact=True)).to_be_visible()


def test_widget_interaction_during_parallel_execution(
    page: Page, app_base_url: str
) -> None:
    """Button click in fast fragment while slow fragment is running."""
    page.goto(build_app_url(app_base_url, query="test=widget_interaction"))
    wait_for_app_run(page)

    expect(page.get_by_text("Counter: 0", exact=True)).to_be_visible()

    click_button(page, "Increment")
    wait_for_app_run(page)

    expect(page.get_by_text("Counter: 1", exact=True)).to_be_visible()


def test_parallel_fragment_error_renders_in_container(
    page: Page, app_base_url: str
) -> None:
    """Error in Fragment A renders in A's container, Fragment B succeeds."""
    page.goto(build_app_url(app_base_url, query="test=error_container"))
    wait_for_app_run(page)

    exception_message = page.get_by_test_id("stExceptionMessage")
    expect(exception_message).to_be_visible()
    expect(exception_message).to_contain_text("ValueError")
    expect(exception_message).to_contain_text("Test error in fragment")
    expect(page.get_by_text("Fragment B success")).to_be_visible()
