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

"""E2E tests for st.bottom container without chat_input.

These tests verify that st.bottom content WITHOUT a chat_input does NOT trigger
the scroll-to-bottom behavior. This is an important regression guard for the
behavioral change introduced in AppView.tsx.
"""

from playwright.sync_api import Page, expect


def test_bottom_without_chat_input_no_scroll_to_bottom(app: Page):
    """Verify st.bottom without chat_input does NOT activate scroll-to-bottom."""
    # Verify bottom container is rendered
    bottom_container = app.get_by_test_id("stBottom")
    expect(bottom_container).to_be_visible()

    # Verify bottom content is present
    bottom_block = app.get_by_test_id("stBottomBlockContainer")
    expect(
        bottom_block.get_by_text("Bottom toolbar without chat input")
    ).to_be_visible()

    # Key assertion: scroll-to-bottom container should NOT be present
    # because there's no chat_input in the bottom container
    scroll_to_bottom = app.get_by_test_id("stAppScrollToBottomContainer")
    expect(scroll_to_bottom).not_to_be_attached()

    # The regular stMain container should be used instead
    main_container = app.get_by_test_id("stMain")
    expect(main_container).to_be_visible()


def test_bottom_without_chat_input_has_iframe_anchor(app: Page):
    """Verify st.bottom without chat_input does NOT have iframe resizer anchor.

    Note: When st.bottom is present (regardless of chat_input), the iframe resizer
    anchor should be hidden because bottom containers don't work well with iframe
    resizers.
    """
    # The iframe resizer anchor should be hidden when bottom container exists
    iframe_anchor = app.get_by_test_id("stAppIframeResizerAnchor")
    expect(iframe_anchor).to_be_hidden()
