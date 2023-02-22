# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

import streamlit as st

valid_label = "**Bold Text** *Italicized* ~Strikethough~ `Code Block` 🐶 :joy:"

color_label = (
    "Colored Text - :red[red] :blue[blue] :green[green] :violet[violet] :orange[orange]"
)

link_label = "Label Link - [Streamlit](https://streamlit.io)"

image = "Image ![Image Text](https://dictionary.cambridge.org/us/images/thumb/corgi_noun_002_08554.jpg?version=5.0.297)"

table = """
| Syntax | Description |
| ----------- | ----------- |
| Header | Title |
| Paragraph | Text |
"""

heading_1 = "# Heading 1"
heading_2 = "## Heading 2"
heading_3 = "### Heading 3"

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

blockquote = "> Testing Blockquote"

horizontal_rule = """
Horizontal Rule:

---

"""

# Invalid Markdown: images, table elements, headings, unordered/ordered lists, task lists, horizontal rules, & blockquotes
with st.container():
    st.subheader(
        "❌ Entirely Disallowed - Images, Table Elements, Headings, Lists, Blockquotes, Horizontal Rules"
    )
    st.button(image)
    st.download_button(table, "some text")
    st.checkbox(heading_1)
    st.radio(heading_2, ["Option 1", "Option 2", "Option 3"])
    st.selectbox(heading_3, ["Option 1", "Option 2", "Option 3"])
    st.multiselect(ordered_list, ["Blue", "Purple", "Green"])
    st.slider(unordered_list, 0, 10, 1)
    st.select_slider(task_list, ["Blue", "Purple", "Green"])
    st.text_input(blockquote)
    st.number_input(horizontal_rule)
    st.text_area(image)
    st.date_input(table, datetime.date(2000, 3, 7))
    st.time_input(heading_1, datetime.time(8, 45))
    st.file_uploader(heading_2)
    st.camera_input(heading_3)
    st.color_picker(ordered_list)
    st.metric(unordered_list, value=7, delta=0.5)
    with st.expander(task_list):
        st.write("Expanded!")
    tabA, tabB = st.tabs([blockquote, horizontal_rule])


# Bold, italics, strikethrough, code, & shortcodes/emojis - allowed in all
with st.container():
    st.subheader(
        "✅ Entirely Allowed - Bold, Italics, Strikethrough, Code, Shortcodes/Emojis"
    )
    st.button(valid_label)
    st.download_button(valid_label, "some text")
    st.checkbox(valid_label)
    st.radio(valid_label, ["Option 1", "Option 2", "Option 3"])
    st.selectbox(valid_label, ["Option 1", "Option 2", "Option 3"])
    st.multiselect(valid_label, ["Blue", "Purple", "Green"])
    st.slider(valid_label, 0, 10, 1)
    st.select_slider(valid_label, ["Blue", "Purple", "Green"])
    st.text_input(valid_label)
    st.number_input(valid_label)
    st.text_area(valid_label)
    st.date_input(valid_label, datetime.date(2000, 3, 7))
    st.time_input(valid_label, datetime.time(8, 45))
    st.file_uploader(valid_label)
    st.camera_input(valid_label)
    st.color_picker(valid_label)
    st.metric(valid_label, value=7, delta=0.5)
    with st.expander(valid_label):
        st.write("Expanded!")
    st.tabs(
        [
            "**Bold Text**",
            "*Italicized*",
            "~Strikethough~",
            "`Code Block`",
            "🐶",
            ":joy:",
        ]
    )


# Colored text - allowed in all
with st.container():
    st.subheader("✅ Entirely Allowed - Colored text")
    st.button(color_label)
    st.download_button(color_label, "some text")
    st.checkbox(color_label)
    st.radio(color_label, ["Option 1", "Option 2", "Option 3"])
    st.selectbox(color_label, ["Option 1", "Option 2", "Option 3"])
    st.multiselect(color_label, ["Blue", "Purple", "Green"])
    st.slider(color_label, 0, 10, 1)
    st.select_slider(color_label, ["Blue", "Purple", "Green"])
    st.text_input(color_label)
    st.number_input(color_label)
    st.text_area(color_label)
    st.date_input(color_label, datetime.date(2000, 3, 7))
    st.time_input(color_label, datetime.time(8, 45))
    st.file_uploader(color_label)
    st.camera_input(color_label)
    st.color_picker(color_label)
    st.metric(color_label, value=7, delta=0.5)
    with st.expander(color_label):
        st.write("Expanded!")
    st.tabs(
        [
            "Colored Text:",
            ":red[red]",
            ":blue[blue]",
            ":green[green]",
            ":violet[violet]",
            ":orange[orange]",
        ]
    )


# Links - only restricted in buttons
with st.container():
    st.subheader("❌ Disallowed in Buttons - Links")
    st.button(link_label)
    st.download_button(link_label, "some text")
with st.container():
    st.subheader("✅ Allowed outside of buttons - Links")
    st.checkbox(link_label)
    st.radio(link_label, ["Option 1", "Option 2", "Option 3"])
    st.selectbox(link_label, ["Option 1", "Option 2", "Option 3"])
    st.multiselect(link_label, ["Blue", "Purple", "Green"])
    st.slider(link_label, 0, 10, 1)
    st.select_slider(link_label, ["Blue", "Purple", "Green"])
    st.text_input(link_label)
    st.number_input(link_label)
    st.text_area(link_label)
    st.date_input(link_label, datetime.date(2000, 3, 7))
    st.time_input(link_label, datetime.time(8, 45))
    st.file_uploader(link_label)
    st.camera_input(link_label)
    st.color_picker(link_label)
    st.metric(link_label, value=7, delta=0.5)
    with st.expander(link_label):
        st.write("Expanded!")
    st.tabs([link_label])
