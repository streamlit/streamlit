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

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded


def test_parallel_fragments_render_all_content(app: Page):
    """All parallel fragment content should appear after the app finishes."""
    wait_for_app_loaded(app)

    markdowns = app.get_by_test_id("stMarkdown")

    expect(markdowns.get_by_text("section_a loaded")).to_be_visible()
    expect(markdowns.get_by_text("fast section loaded")).to_be_visible()
    expect(markdowns.get_by_text("section_b loaded")).to_be_visible()


def test_main_thread_not_blocked(app: Page):
    """The main thread should complete nearly instantly (parallel dispatch)."""
    wait_for_app_loaded(app)

    main_time_el = app.get_by_text("main_thread_time:")
    expect(main_time_el).to_be_visible()
    text = main_time_el.text_content()
    assert text is not None
    elapsed = float(text.split(": ")[1])
    assert elapsed < 0.5, (
        f"Main thread took {elapsed:.2f}s — expected < 0.5s (fragments should run in parallel)"
    )


def test_dispatch_markers_appear_immediately(app: Page):
    """Markers written after parallel dispatch should appear in correct order."""
    wait_for_app_loaded(app)

    markdowns = app.get_by_test_id("stMarkdown")
    expect(markdowns.get_by_text("after section_a dispatched")).to_be_visible()
    expect(markdowns.get_by_text("after fast_section dispatched")).to_be_visible()
    expect(markdowns.get_by_text("after section_b dispatched")).to_be_visible()
