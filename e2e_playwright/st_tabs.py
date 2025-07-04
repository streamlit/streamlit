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

import streamlit as st

tab1, tab2, tab3 = st.tabs(["Tab 1", "Tab 2", "Tab 3"])

with tab1:
    st.write("tab1")
    st.text_input("Text input")

with tab2:
    st.write("tab2")
    st.number_input("Number input")

with tab3:
    st.write("tab3")
    st.date_input("Date input")

with st.expander("Expander", expanded=True):
    many_tabs = st.tabs([f"Tab {i}" for i in range(25)])

sidebar_tab1, sidebar_tab2 = st.sidebar.tabs(["Foo", "Bar"])
sidebar_tab1.write("I am in the sidebar")
sidebar_tab2.write("I'm also in the sidebar")

st.tabs(
    [
        "**Bold Text**",
        "*Italicized*",
        "~Strikethough~",
        "`Code Block`",
        "🐶",
        ":joy:",
        ":material/check_circle: Icon",
    ]
)


tabs = st.tabs(["HTML Tab 1", "HTML Tab 2", "HTML Tab 3"])

for i, tab in enumerate(tabs):
    tab.html(f"<h1>Hello</h1><p>This is HTML tab {i + 1}</p>")

fixed_width_tabs = st.tabs(["width_test_1", "width_test_2", "width_test_3"], width=200)

for i, tab in enumerate(fixed_width_tabs):
    tab.write(f"Hello {i}")

# Tabs layout tests.
tab_with_code_1, tab_with_code_2 = st.tabs(["Tab 1", "Tab 2"])

container = tab_with_code_1.container(height=200)
container.code(
    """
def hello():
    print("Hello, Streamlit!")
""",
    height="stretch",
)

tab_with_code_2.code(
    """
def hello():
    print("Hello, Streamlit!")
""",
    height=200,
)

tab_with_code_2.code(
    """
def hello():
    print("Hello, Streamlit!")
""",
    height="stretch",
)
