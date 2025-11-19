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


def page1():
    st.title("Page1")

    st.write("""
      Instructions:

      * Click the button below.
      * A new tab will open (that's OK)
      * The app in that tab should scroll down to 'My title 2'
    """)
    st.link_button("Open new tab", "/page2#my-title-2")


def page2():
    st.title("Page2")

    st.header("My title 1")
    for _ in range(30):
        st.text("blah " * 100)

    st.header("My title 2")
    for _ in range(30):
        st.text("blah " * 100)


page = st.navigation(
    [
        st.Page(page1, title="Page1"),
        st.Page(page2, title="Page2"),
    ]
)

page.run()
