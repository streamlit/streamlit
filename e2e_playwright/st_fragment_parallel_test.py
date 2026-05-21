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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_run
from e2e_playwright.shared.app_utils import click_button, get_element_by_key


def test_parallel_fragments_render_concurrently(app: Page) -> None:
    """3 parallel fragments with staggered sleep times all render concurrently.

    Presence of all three fragment outputs plus "All fragments dispatched" confirms
    the parallel dispatch path executed successfully.
    """
    expect(app.get_by_text("Fragment 1 done")).to_be_visible()
    expect(app.get_by_text("Fragment 2 done")).to_be_visible()
    expect(app.get_by_text("Fragment 3 done")).to_be_visible()
    expect(app.get_by_text("All fragments dispatched")).to_be_visible()


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
    """Fragments render in DOM order matching **invocation** order in the script.

    The test app invokes slow_fragment_3, then 1, then 2 — not 1→2→3 — so DOM
    order is not predictable from numeric labels alone.

    Despite staggered sleeps (Fragment 3 finishes first), DOM order follows
    invocation (3 above 1 above 2), not completion time.
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
    assert box3["y"] < box1["y"], (
        "Fragment 3 (invoked first) should be above Fragment 1"
    )
    assert box1["y"] < box2["y"], "Fragment 1 should be above Fragment 2"


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
    expect(vertical_blocks).not_to_have_count(0)
    for i in range(vertical_blocks.count()):
        block = vertical_blocks.nth(i)
        inner_text = block.inner_text()
        assert inner_text.strip() != "", f"Found empty container at index {i}"
