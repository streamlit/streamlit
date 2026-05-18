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
from e2e_playwright.shared.app_utils import click_button


def test_parallel_fragments_render_concurrently(app: Page) -> None:
    """3 fragments with staggered sleep times all render."""
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
    """Fragments render in declaration order."""
    expected_subset = [
        "Fragment 1 done",
        "Fragment 2 done",
        "Fragment 3 done",
    ]
    for expected in expected_subset:
        expect(app.get_by_text(expected, exact=True)).to_be_visible()
