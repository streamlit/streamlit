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

import time
from pathlib import Path

from PIL import Image

import streamlit as st

PARENT_DIR = Path(__file__).parent.parent / "multipage_apps"
SMALL_LOGO = Image.open(str(PARENT_DIR / "small-streamlit.png"))

LOGO = Image.open(str(PARENT_DIR / "full-streamlit.png"))

st.logo(LOGO, link="https://www.example.com", icon_image=SMALL_LOGO)

st.header("Main Page")
x = st.slider("x")

st.write(f"x is {x}")

set_default = bool(st.query_params.get("default", False))

page2 = st.Page("page_2.py")
page3 = st.Page("page_3.py", title="Different Title")
page4 = st.Page("🦒_page_4.py")
page5 = st.Page(Path("page_5.py"), icon=":material/settings:")
page6 = st.Page("page_6_slow_page.py", title="slow page")


def page_7():
    st.header("Page 7")
    x = st.slider("y")
    st.write(f"y is {x}")


def page_8():
    st.header("Page 8")


def page_9():
    st.header("Page 9")


def page_10():
    st.header("Page 10")

    @st.fragment
    def get_input():
        st.text_input("Some input")
        if st.button("Submit"):
            st.rerun()

    get_input()


def page_14() -> None:
    time.sleep(0.5)
    st.number_input("mynum", value=1, key="mynum")

    @st.fragment
    def fragment_number_input() -> None:
        st.number_input("mynum 2", value=1, key="mynum2")

    fragment_number_input()


page7 = st.Page(page_7, default=set_default)
page8 = st.Page(page_8, url_path="my_url_path")
page9 = st.Page(page_9)
page10 = st.Page(page_10)
page11 = st.Page(page_8, title="page 11", url_path="page_11")
page12 = st.Page(page_9, title="page 12", url_path="page_12")
page13 = st.Page(page_8, title="page 13", url_path="page_13")
page14 = st.Page(page_14, title="page 14")

hide_sidebar = st.checkbox("Hide sidebar")
dynamic_nav = st.checkbox("Change navigation dynamically")
expanded = st.checkbox("Expand navigation")
test_mixed_sections = st.checkbox("Test Mixed Empty/Named Sections")
test_empty_middle = st.checkbox("Test Empty Section in Middle")

# Configure pages based on test mode
if test_mixed_sections:
    # Mixed empty and named sections
    pages_config = {
        "": [page2, page3],
        "Admin": [page4, page5],
        "Reports": [page6],
    }
elif test_empty_middle:
    # Empty section in the middle of named sections
    pages_config = {
        "Section A": [page2, page3],
        "": [page4, page5],
        "Section B": [page6, page7],
        "Section C": [page8, page9],
    }
elif dynamic_nav:
    pages_config = [page2, page3, page5, page9]  # type: ignore
else:
    pages_config = {
        "Section 1 - long title that should be truncated": [page2, page3],
        "Section 2": [page4, page5],
        "Section 3": [page6],
        "Section 4": [page7, page8, page9],
        "Section 5": [page10, page11, page12],
        "Section 6": [page13, page14],
    }

pg = st.navigation(
    pages_config,
    position="hidden" if hide_sidebar else "sidebar",
    expanded=expanded,
)

if st.button("page 5"):
    st.switch_page("page_5.py")

if st.button("page 9"):
    st.switch_page(page9)

if st.checkbox("Show sidebar elements"):
    st.sidebar.write("Sidebar content")

pg.run()

st.page_link("page_5.py", label="page 5 page link")

st.page_link(page9, label="page 9 page link")

st.write("Context URL:", st.context.url)

st.write("End of Script")
