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

from random import random

import streamlit as st

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

random_str = str(random())
clicked = st.download_button(label="Download random text", data=random_str)

st.write(f"value: {clicked}")
