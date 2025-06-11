# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import re
from typing import Callable

from playwright.sync_api import Locator, Page, expect

from e2e_playwright.shared.app_utils import get_element_by_key, select_radio_option

# List of markdown features that are not allowed in (widget) labels:

DISALLOWED_FEATURES_IN_LABEL: list[str] = [
    "Blockquote",
    "Heading 1",
    "Heading 2",
    "Table",
    "Ordered list",
    "Unordered list",
    "Task list",
    "Horizontal rule",
]
DISALLOWED_FEATURES_IN_HEADINGS: list[str] = ["Blockquote", "Table"]
# List of markdown features that are not allowed in button-like elements:
DISALLOWED_FEATURES_IN_BUTTONS: list[str] = [*DISALLOWED_FEATURES_IN_LABEL, "Link"]

# Mapping between a feature and the supported markdown features:
DISALLOWED_MARKDOWN_FEATURES: dict[str, list[str]] = {
    "st_write": [],
    "st_markdown": [],
    "st_caption": [],
    "st_success": [],
    "st_error": [],
    "st_warning": [],
    "st_info": [],
    "st_title": [*DISALLOWED_FEATURES_IN_HEADINGS, "Heading 2"],
    "st_header": [*DISALLOWED_FEATURES_IN_HEADINGS, "Heading 1"],
    "st_subheader": [*DISALLOWED_FEATURES_IN_HEADINGS, "Heading 1", "Heading 2"],
    "st_checkbox": DISALLOWED_FEATURES_IN_LABEL,
    "st_toggle": DISALLOWED_FEATURES_IN_LABEL,
    "st_radio_widget_label": DISALLOWED_FEATURES_IN_LABEL,
    "st_radio_option_label": DISALLOWED_FEATURES_IN_LABEL,
    "st_selectbox": DISALLOWED_FEATURES_IN_LABEL,
    "st_multiselect": DISALLOWED_FEATURES_IN_LABEL,
    "st_slider": DISALLOWED_FEATURES_IN_LABEL,
    "st_select_slider": DISALLOWED_FEATURES_IN_LABEL,
    "st_text_input": DISALLOWED_FEATURES_IN_LABEL,
    "st_number_input": DISALLOWED_FEATURES_IN_LABEL,
    "st_text_area": DISALLOWED_FEATURES_IN_LABEL,
    "st_date_input": DISALLOWED_FEATURES_IN_LABEL,
    "st_time_input": DISALLOWED_FEATURES_IN_LABEL,
    "st_file_uploader": DISALLOWED_FEATURES_IN_LABEL,
    "st_color_picker": DISALLOWED_FEATURES_IN_LABEL,
    "st_audio_input": DISALLOWED_FEATURES_IN_LABEL,
    "st_button": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_download_button": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_link_button": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_popover": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_pills_button_label": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_pills_widget_label": DISALLOWED_FEATURES_IN_LABEL,
    "st_segmented_control_button_label": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_segmented_control_widget_label": DISALLOWED_FEATURES_IN_LABEL,
    "st_page_link": DISALLOWED_FEATURES_IN_BUTTONS,
    "st_expander": DISALLOWED_FEATURES_IN_LABEL,
    "st_tabs": DISALLOWED_FEATURES_IN_LABEL,
    "st_metric": DISALLOWED_FEATURES_IN_LABEL,
    "st_image": DISALLOWED_FEATURES_IN_LABEL,
    "st_progress": DISALLOWED_FEATURES_IN_LABEL,
    "st_table": [],
}

# Mapping between a markdown feature and the playwright locator to detect the feature:
MARKDOWN_FEATURE_PLAYWRIGHT_LOCATORS: dict[str, Callable[[Locator], Locator]] = {
    "Bold": lambda locator: locator.locator("strong"),
    "Italic": lambda locator: locator.locator("em"),
    "Strikethrough": lambda locator: locator.locator("del"),
    "Code": lambda locator: locator.locator("code"),
    "Emoji": lambda locator: locator.get_by_text("🐶"),
    "Emoji shortcode": lambda locator: locator.get_by_text("😂"),
    "Arrows & dashes": lambda locator: locator.get_by_text("← → ↔ — ≥ ≤ ≈"),
    "Material Icon": lambda locator: locator.locator("span").get_by_text(
        "check_circle"
    ),
    "Streamlit Logo": lambda locator: locator.locator("img"),
    "Image": lambda locator: locator.locator("img"),
    "Colored Text": lambda locator: locator.locator("span"),
    "Colored Background": lambda locator: locator.locator("span"),
    "Badge": lambda locator: locator.locator("span"),
    "Latex": lambda locator: locator.locator("span.katex"),
    "Link": lambda locator: locator.locator("a"),
    "Blockquote": lambda locator: locator.locator("blockquote"),
    "Heading 1": lambda locator: locator.locator("h1"),
    "Heading 2": lambda locator: locator.locator("h2"),
    "Table": lambda locator: locator.locator("table"),
    "Ordered list": lambda locator: locator.locator("ol"),
    "Unordered list": lambda locator: locator.locator("ul"),
    "Task list": lambda locator: locator.locator("ul.contains-task-list"),
    "Horizontal rule": lambda locator: locator.locator("hr"),
}


def test_markdown_restrictions_for_all_elements(app: Page):
    """Test that markdown restrictions are correctly applied to all elements."""

    # Iterate through all markdown features
    for feature, locator_fn in MARKDOWN_FEATURE_PLAYWRIGHT_LOCATORS.items():
        # Select the current markdown feature
        select_radio_option(app, re.compile(f"^{feature}$"), label="Markdown Features")

        # Test the feature against all Streamlit elements
        for element_name, disallowed_features in DISALLOWED_MARKDOWN_FEATURES.items():
            # Get the container for the current element
            container = get_element_by_key(app, element_name)
            expect(container).to_be_visible()

            markdown_container_test_id = "stMarkdownContainer"

            # st.caption and st.image caption uses a different container
            if element_name in ["st_caption", "st_image"]:
                markdown_container_test_id = "stCaptionContainer"

            element_locator = locator_fn(
                container.get_by_test_id(markdown_container_test_id)
            )

            if feature in disallowed_features:
                # Feature should not be present
                expect(element_locator.first).not_to_be_attached()
            else:
                # Feature should be present
                expect(element_locator.first).to_be_visible()
