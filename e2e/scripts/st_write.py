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

import time

import numpy as np
import pandas as pd

import streamlit as st
from tests.streamlit import pyspark_mocks

st.write("This **markdown** is awesome! :sunglasses:")

st.write("This <b>HTML tag</b> is escaped!")

st.write(pyspark_mocks.DataFrame())

st.write("This <b>HTML tag</b> is not escaped!", unsafe_allow_html=True)


_LOREM_IPSUM = """
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in
voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat
non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
"""


def stream_example():
    for word in _LOREM_IPSUM.split():
        yield word + " "
        time.sleep(0.1)

    # Also supports any other object supported by `st.write`
    yield pd.DataFrame(
        np.random.randn(5, 10),
        columns=["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    )

    for word in _LOREM_IPSUM.split():
        yield word + " "
        time.sleep(0.05)


if st.button("Stream data"):
    st.session_state["written_content"] = st._main._stream(stream_example)
else:
    if "written_content" in st.session_state:
        st.write(st.session_state["written_content"])
        time.sleep(5)
