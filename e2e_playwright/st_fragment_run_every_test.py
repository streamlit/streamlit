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

"""End-to-end coverage for fragment `run_every` stability and cleanup."""

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import click_toggle


def _get_fragment_markdown(app: Page, text: str) -> Locator:
    """Return the markdown node that renders the fragment text prefix."""

    return app.get_by_test_id("stMarkdown").filter(has_text=text)


def test_fragment_runs_at_interval(app: Page):
    """Verify a standalone `run_every` fragment keeps updating."""

    fragment = _get_fragment_markdown(app, "standalone uuid in fragment:")
    fragment_text = fragment.text_content()

    assert fragment_text is not None

    # Verify that the fragment text updates a few times.
    for _ in range(3):
        expect(fragment).not_to_have_text(fragment_text)
        fragment_text = fragment.text_content()
        assert fragment_text is not None


def test_nested_fragment_run_every_can_disappear_without_crashing(app: Page):
    """Ensure hiding a nested auto-rerun fragment cleans up its stale timer."""

    standalone_fragment = _get_fragment_markdown(app, "standalone uuid in fragment:")
    nested_fragment = _get_fragment_markdown(app, "nested uuid in fragment:")

    standalone_text = standalone_fragment.text_content()
    nested_text = nested_fragment.text_content()

    assert standalone_text is not None
    assert nested_text is not None

    # Let the nested fragment tick once so its stale timer is live before we hide it.
    expect(nested_fragment).not_to_have_text(nested_text)

    click_toggle(app, "Show nested auto fragment")

    expect(nested_fragment).to_have_count(0)

    # Wait for multiple standalone ticks so a stale nested timer has enough time
    # to queue one last rerun and surface the original delta-path crash.
    for _ in range(2):
        expect(standalone_fragment).not_to_have_text(standalone_text)
        standalone_text = standalone_fragment.text_content()
        assert standalone_text is not None
        expect(app.get_by_test_id("stException")).to_have_count(0)

    click_toggle(app, "Show nested auto fragment")

    expect(nested_fragment).to_have_count(1)
    expect(app.get_by_test_id("stException")).to_have_count(0)
