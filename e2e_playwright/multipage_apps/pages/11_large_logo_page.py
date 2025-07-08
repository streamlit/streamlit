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

import pathlib

from PIL import Image

import streamlit as st

small_logo = Image.open(
    str(pathlib.Path(__file__).parent.parent / "small-streamlit.png")
)

logo = Image.open(str(pathlib.Path(__file__).parent.parent / "full-streamlit.png"))

st.header("Logo page")
st.logo(
    logo,
    link="https://www.example.com",
    icon_image=small_logo,
    size="large",
)

with st.sidebar:
    st.radio("Example Sidebar Content", ["Home", "About", "Contact"])
