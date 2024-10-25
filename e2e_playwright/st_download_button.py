# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

from pathlib import Path
from random import random

import streamlit as st
from streamlit import runtime

# Construct test assets path relative to this script file to
# allow its execution with different working directories.
TEST_ASSETS_DIR = Path(__file__).parent / "test_assets"
CAT_IMAGE = TEST_ASSETS_DIR / "cat.jpg"

st.download_button(
    "Download button label",
    data="Hello world!",
    file_name="hello.txt",
)

st.download_button(
    "Download button label",
    data="Hello world!",
    file_name="hello.txt",
    key="disabled_dl_button",
    disabled=True,
)

st.download_button(
    "Download RAR archive file",
    data=b"bytes",
    file_name="archive.rar",
    mime="application/vnd.rar",
)

with open(CAT_IMAGE, "rb") as f:
    st.download_button(
        "Download image file",
        data=f,
        file_name="cat.jpg",
    )

st.download_button(
    "Download button with use_container_width=True",
    data="Hello world!",
    file_name="hello.txt",
    use_container_width=True,
)

st.download_button(
    "Download button with help text and use_container_width=True",
    data="Hello world!",
    file_name="hello.txt",
    use_container_width=True,
    help="Example help text",
)

st.download_button(
    "Primary download button",
    data="Hello world!",
    file_name="hello.txt",
    type="primary",
)

st.download_button(
    "Button with emoji icon",
    data="Hello world!",
    icon="⬇️",
)

st.download_button(
    "Button with material icon",
    data="Hello world!",
    icon=":material/download:",
)

random_str = str(random())
clicked = st.download_button(label="Download random text", data=random_str)

st.write(f"value: {clicked}")

# st.session_state can only be used in streamlit
if runtime.exists():

    def on_click(x, y):
        if "click_count" not in st.session_state:
            st.session_state.click_count = 0

        st.session_state.click_count += 1
        st.session_state.x = x
        st.session_state.y = y

    i1 = st.download_button(
        "Download + On Click",
        key="download_button",
        data="Hello world!",
        on_click=on_click,
        args=(1,),
        kwargs={"y": 2},
    )
    st.write("value:", i1)
    st.write("value from state:", st.session_state["download_button"])

    button_was_clicked = "click_count" in st.session_state
    st.write("Download Button was clicked:", button_was_clicked)

    if button_was_clicked:
        st.write("times clicked:", st.session_state.click_count)
        st.write("arg value:", st.session_state.x)
        st.write("kwarg value:", st.session_state.y)

i2 = st.checkbox("reset button return value")
