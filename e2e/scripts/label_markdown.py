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

import streamlit as st

# Valid markdown: italics, bold, strikethrough, emojis, code, & colored text
st.button("*Fancy* **Stop** ~Button~ :smile: `some code` - :violet[colored text]")
st.download_button(
    "*Fancy* **Stop** ~Button~ :smile: `code` - :violet[colored text]",
    "This is some text",
)

# Invalid button markdown: links
st.button("Test [Link](www.example.com)")
st.download_button("Download [Link](www.example.com)", "some text")

# Valid checkbox markdown: italics, bold, strikethrough, emoji, link, code
st.checkbox("*Fancy* **Checkbox** ~Label~ :smile: `some code` - :violet[colored text]")


# st.metric(label="Temperature = *Spicy* :hot_pepper:", value="105 °F", delta=None)

# st.radio(
#     "What's your favorite `coding` language? :computer:",
#     ("Python", "Javascript", "Ruby"),
# )

# st.selectbox(
#     "How would you like to be [contacted](https://dictionary.cambridge.org/us/dictionary/english/contacted)?",
#     ("Carrier Pidgeon", "Email", "Mobile phone"),
# )

# table = """Table:
# | Syntax | Description |
# | ----------- | ----------- |
# | Header | Title |
# | Paragraph | Text |
# """
# expand = st.expander("An **expander**.. with surprises ~~widgets~~ inside :cyclone:")
# expand.text_area(table)

# tab1, tab2, tab3 = st.tabs(["**Cat** :cat:", "*Dog* :dog:", "~~Owl~~ :owl:"])
