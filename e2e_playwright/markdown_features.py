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

import datetime

import numpy as np

import streamlit as st

markdown_table = """
| Syntax | Description |
| ----------- | ----------- |
| Header | Title |
| Paragraph | Text |
"""

ordered_list = """
 1. First Item
 2. Second Item
"""

unordered_list = """
 - Item 1
 - Item 2
"""

task_list = """
- [x] Write the press release
- [ ] Update the website
- [ ] Contact the media
"""

horizontal_rule = """
Horizontal Rule:

---

"""

MARKDOWN_FEATURES = {
    "Normal": "Normal Text",
    "Bold": "**Bold Text**",
    "Italic": "*Italicized*",
    "Strikethrough": "~Strikethough~",
    "Code": "`Code Block`",
    "Emoji": "Emoji: 🐶",
    "Emoji shortcode": ":joy:",
    "Arrows & dashes": "<- -> <-> -- >= <= ~=",
    "Material Icon": "Icon: :material/check_circle:",
    "Streamlit Logo": "Logo: :streamlit:",
    "Image": "![Image Text](app/static/cat.jpg)",
    "Colored Text": ":red[Colored] :rainbow[Text]",
    "Colored Background": ":blue-background[Colored] :red-background[Background]",
    "Badge": ":blue-badge[Badge] :red-badge[Badge]",
    "Latex": "$ax^2 + bx + c = 0$",
    "Link": "[Link](https://streamlit.io)",
    "Blockquote": "> Testing Blockquote",
    "Heading 1": "# Heading 1",
    "Heading 2": "## Heading 2",
    "Table": markdown_table,
    "Ordered list": ordered_list,
    "Unordered list": unordered_list,
    "Task list": task_list,
    "Horizontal rule": horizontal_rule,
}


selected_feature = st.radio("Markdown Features", list(MARKDOWN_FEATURES.keys()))
selected_feature_markdown = MARKDOWN_FEATURES[selected_feature]

st.header("Text Elements", divider=True)

st.container(key="st_write").write(selected_feature_markdown)
st.container(key="st_markdown").markdown(selected_feature_markdown)
st.container(key="st_title").title(selected_feature_markdown)
st.container(key="st_header").header(selected_feature_markdown)
st.container(key="st_subheader").subheader(selected_feature_markdown)
st.container(key="st_caption").caption(selected_feature_markdown)
st.container(key="st_success").success(selected_feature_markdown)
st.container(key="st_error").error(selected_feature_markdown)
st.container(key="st_warning").warning(selected_feature_markdown)
st.container(key="st_info").info(selected_feature_markdown)

st.header("Widgets", divider=True)

st.container(key="st_checkbox").checkbox(selected_feature_markdown)
st.container(key="st_toggle").toggle(selected_feature_markdown)
st.container(key="st_radio_widget_label").radio(
    selected_feature_markdown, ["Option 1", "Option 2"]
)
st.container(key="st_radio_option_label").radio(
    "Option Label Test", [selected_feature_markdown, "Option 2"]
)
st.container(key="st_selectbox").selectbox(
    selected_feature_markdown,
    ["Option 1", "Option 2"],
)
st.container(key="st_multiselect").multiselect(
    selected_feature_markdown, ["Blue", "Purple"]
)
st.container(key="st_slider").slider(selected_feature_markdown, 0, 10, 1)
st.container(key="st_select_slider").select_slider(
    selected_feature_markdown, ["Blue", "Purple"]
)
st.container(key="st_text_input").text_input(selected_feature_markdown)
st.container(key="st_number_input").number_input(selected_feature_markdown)
st.container(key="st_text_area").text_area(selected_feature_markdown)
st.container(key="st_date_input").date_input(
    selected_feature_markdown, datetime.date(2000, 3, 7)
)
st.container(key="st_time_input").time_input(
    selected_feature_markdown, datetime.time(8, 45)
)
st.container(key="st_file_uploader").file_uploader(selected_feature_markdown)
st.container(key="st_color_picker").color_picker(selected_feature_markdown)
st.container(key="st_audio_input").audio_input(selected_feature_markdown)


st.header("Button-like Elements", divider=True)

st.container(key="st_button").button(selected_feature_markdown)
st.container(key="st_download_button").download_button(
    selected_feature_markdown, "Text"
)
st.container(key="st_link_button").link_button(
    selected_feature_markdown, "https://streamlit.io"
)
st.container(key="st_popover").popover(selected_feature_markdown).write("Expanded!")
st.container(key="st_pills_widget_label").pills(selected_feature_markdown, ["Option 1"])
st.container(key="st_pills_button_label").pills(
    "Button Label Test", [selected_feature_markdown]
)
st.container(key="st_segmented_control_widget_label").segmented_control(
    selected_feature_markdown, ["Option 1"]
)
st.container(key="st_segmented_control_button_label").segmented_control(
    "Button Label Test", [selected_feature_markdown]
)
st.container(key="st_page_link").page_link(
    "https://streamlit.io", label=selected_feature_markdown
)


st.header("Containers", divider=True)

st.container(key="st_expander").expander(selected_feature_markdown).write("Expanded!")
st.container(key="st_tabs").tabs([selected_feature_markdown])


st.header("Other Elements", divider=True)

st.container(key="st_metric").metric(selected_feature_markdown, value=7, delta=0.5)
st.container(key="st_image").image(
    np.repeat(0, 10000).reshape(100, 100), caption=selected_feature_markdown
)
st.container(key="st_progress").progress(0.5, selected_feature_markdown)
st.container(key="st_table").table(
    {
        "Header": [selected_feature_markdown],
    }
)
