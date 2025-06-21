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

import io
from datetime import datetime

import numpy as np

import streamlit as st

st.subheader("st.write(markdown)")

st.write("Hello", "World")

st.write("This **markdown** is awesome! :sunglasses:")

st.write("This <b>HTML tag</b> is escaped!")

st.write("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)


st.write(100)

st.write(None)

st.write(datetime(2021, 1, 1))

st.write(np.float64(1.0))


class SomeObject1:
    def __str__(self) -> str:
        return "1 * 2 - 3 = 4 `ok` !"


st.write(SomeObject1())  # escaped single line string


class SomeObject2:
    def __str__(self) -> str:
        return "1 * 2\n - 3\n ``` = \n````\n4 `ok` !"


st.write(SomeObject2())  # escaped multiline string

string_io = io.StringIO()
string_io.write("This is a string IO object!")

st.write(string_io)


def stream_text():
    yield "This is "
    yield "streamed text"


st.subheader("st.write(generator)")

st.write(stream_text)

st.write(stream_text())

st.write((["zero", " one", "    two"], 3))
