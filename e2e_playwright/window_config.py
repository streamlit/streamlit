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

"""Streamlit app to test window.__streamlit configuration security."""

import streamlit as st


def home_page():
    st.title("Window Config Security Test")

    st.write("This app is used to test that `window.__streamlit` configuration")
    st.write("is captured at load time and cannot be modified afterwards.")

    st.divider()

    # Display some content to verify theme application
    st.subheader(":primary[Primary Colored] Header")
    st.button("Click me", type="primary")
    st.text_input("Enter text")
    st.slider("Choose value", 0, 100, 50)

    # Add download button for testing DOWNLOAD_ASSETS_BASE_URL usage
    st.download_button(
        label="Download Test File",
        data="This is test content for download",
        file_name="test.txt",
        mime="text/plain",
    )


def second_page():
    st.title("Second Page")
    st.write("This is page 2 for testing MAIN_PAGE_BASE_URL navigation.")
    st.button("Page 2 Button")


def third_page():
    st.title("Third Page")
    st.write("This is page 3 for testing MAIN_PAGE_BASE_URL navigation.")
    st.button("Page 3 Button")


# Create navigation
home = st.Page(home_page, title="Home", url_path="home", icon=":material/home:")
page2 = st.Page(second_page, title="Page 2", url_path="page2", icon=":material/star:")
page3 = st.Page(
    third_page, title="Page 3", url_path="page3", icon=":material/analytics:"
)

pg = st.navigation([home, page2, page3])
pg.run()
