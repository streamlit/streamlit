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

import asyncio
import time

import numpy as np
import pandas as pd

import streamlit as st

np.random.seed(0)


_LOREM_IPSUM = """
Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
laboris nisi ut aliquip ex ea commodo consequat.
"""


button_group = st.container()
stream_output = st.container(key="stream-output")

# Replay the last output:
if "written_content" in st.session_state:
    stream_output.write(st.session_state["written_content"])


def stream_example():
    for word in _LOREM_IPSUM.split():
        yield word + " "
        time.sleep(0.02)

    yield pd.DataFrame(
        np.random.randn(5, 10),
        columns=["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    )

    for word in "This is the end of the stream.".split():
        yield word + " "
        time.sleep(0.02)


async def async_generator():
    for word in _LOREM_IPSUM.split():
        yield word + " "
        await asyncio.sleep(0.02)
    yield pd.DataFrame(
        np.random.randn(5, 10),
        columns=["a", "b", "c", "d", "e", "f", "g", "h", "i", "j"],
    )

    for word in "This is the end of the stream.".split():
        yield word + " "
        await asyncio.sleep(0.02)


if button_group.button("Stream data"):
    st.session_state["written_content"] = stream_output.write_stream(stream_example)

if button_group.button("Stream async data"):
    st.session_state["written_content"] = stream_output.write_stream(async_generator)
