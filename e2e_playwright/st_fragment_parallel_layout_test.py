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

"""E2E tests for parallel fragment layout & rendering (E3, E13, E15)."""

import re

from playwright.sync_api import Page, expect

from e2e_playwright.conftest import wait_for_app_loaded
from e2e_playwright.shared.app_utils import expect_no_exception


def test_e3_source_order_layout_preservation(app: Page):
    """E3: Fragments render in source (declaration) order regardless of completion order.

    4 fragments with decreasing delays — D finishes first, A finishes last.
    DOM order must match declaration order: A, B, C, D.
    """
    wait_for_app_loaded(app)

    markdowns = app.get_by_test_id("stMarkdown")

    expect(markdowns.get_by_text("e3_section_a")).to_be_visible()
    expect(markdowns.get_by_text("e3_section_b")).to_be_visible()
    expect(markdowns.get_by_text("e3_section_c")).to_be_visible()
    expect(markdowns.get_by_text("e3_section_d")).to_be_visible()

    all_texts = markdowns.all_text_contents()
    section_indices = []
    for label in ["e3_section_a", "e3_section_b", "e3_section_c", "e3_section_d"]:
        for idx, text in enumerate(all_texts):
            if label in text:
                section_indices.append(idx)
                break

    assert len(section_indices) == 4, (
        f"Expected 4 sections, found {len(section_indices)}"
    )
    assert section_indices == sorted(section_indices), (
        f"DOM order should be A < B < C < D, got indices: {section_indices}"
    )

    expect_no_exception(app)


def test_e13_return_value_is_none(app: Page):
    """E13: Calling a parallel fragment returns None immediately."""
    wait_for_app_loaded(app)

    expect(app.get_by_text("e13_result: None")).to_be_visible()
    expect(app.get_by_text(re.compile(r"e13_result: (?!None)"))).not_to_be_attached()


def test_e15_stress_test_many_parallel_fragments(app: Page):
    """E15: 10 parallel fragments each sleeping 0.5s all render, total time bounded."""
    wait_for_app_loaded(app)

    for i in range(10):
        expect(app.get_by_text(f"e15_frag_{i}")).to_be_visible()

    dispatch_el = app.get_by_text("e15_dispatch_time:")
    expect(dispatch_el).to_be_visible()
    text = dispatch_el.text_content()
    assert text is not None
    elapsed = float(text.split(": ")[1])
    assert elapsed < 1.0, (
        f"Dispatch of 10 fragments took {elapsed:.2f}s — expected < 1.0s"
    )

    expect_no_exception(app)
