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

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, get_element_by_key


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
    expect(app.get_by_text("Fragment 1 done", exact=True)).to_be_visible()
    expect(app.get_by_text("Fragment 2 done", exact=True)).to_be_visible()
    expect(app.get_by_text("Fragment 3 done", exact=True)).to_be_visible()

    main_view = app.get_by_test_id("stAppViewBlockContainer")
    fragment_texts = main_view.locator("p").filter(
        has_text=re.compile(r"Fragment \d done")
    )
    expect(fragment_texts).to_have_count(3)

    texts = fragment_texts.all_text_contents()
    assert texts == ["Fragment 1 done", "Fragment 2 done", "Fragment 3 done"], (
        f"DOM order {texts} does not match declaration order"
    )


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
