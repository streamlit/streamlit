# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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
import os
import time
import uuid
from pathlib import Path
from typing import TYPE_CHECKING, cast

import numpy as np
import requests

import streamlit as st

if TYPE_CHECKING:
    import numpy.typing as npt


@st.cache_data
def with_cached_widget_warning():
    st.write("Cached function that should show a widget usage warning.")
    st.selectbox("selectbox", ["foo", "bar", "baz", "qux"], index=1)


if st.button("Run cached function with widget warning"):
    with_cached_widget_warning()


@st.cache_data
def inner_cache_function():
    st.radio("radio 2", ["foo", "bar", "baz", "qux"], index=1)


@st.cache_data
def nested_cached_function():
    inner_cache_function()
    st.selectbox("selectbox 2", ["foo", "bar", "baz", "qux"], index=1)


if st.button("Run nested cached function with widget warning"):
    # When running nested_cached_function(), we get two warnings, one from
    # nested_cached_function() and one from inner_cache_function.
    nested_cached_function()


if "run_counter" not in st.session_state:
    st.session_state.run_counter = 0


@st.cache_data
def replay_element() -> int:
    st.session_state.run_counter += 1
    st.markdown(f"Cache executions: {st.session_state.run_counter}")
    return cast("int", st.session_state.run_counter)


if st.button("Cached function with element replay"):
    st.write("Cache return", replay_element())


def _wait_for_release_file(release_file: Path) -> None:
    while not release_file.exists():
        time.sleep(0.05)


@st.cache_data(show_spinner="Computing async cache_data value...")
async def async_cache_data_value(
    session_key: str,  # noqa: ARG001 - Parameter is the per-session cache key.
) -> dict[str, int]:
    st.session_state.async_cache_data_executions = (
        st.session_state.get("async_cache_data_executions", 0) + 1
    )
    st.markdown(
        f"Inside async cache_data: {st.session_state.async_cache_data_executions}"
    )
    release_file = Path(os.environ["STREAMLIT_ASYNC_CACHE_DATA_RELEASE_FILE"])
    await asyncio.to_thread(_wait_for_release_file, release_file)
    return {"execution": st.session_state.async_cache_data_executions}


async def render_async_cache_data_value() -> None:
    value = await async_cache_data_value(st.session_state.async_cache_data_key)
    st.markdown(f"Async cache_data result: {value['execution']}")


if "async_cache_data_key" not in st.session_state:
    st.session_state.async_cache_data_key = uuid.uuid4().hex

if st.button("Run async cache_data E2E scenario"):
    st.session_state.run_async_cache_data_e2e_scenario = True

if st.session_state.get("run_async_cache_data_e2e_scenario", False):
    asyncio.run(render_async_cache_data_value())


@st.cache_data
def audio():
    url = "https://www.w3schools.com/html/horse.ogg"
    file = requests.get(url).content
    st.audio(file)


@st.cache_data
def video():
    url = "https://www.w3schools.com/html/mov_bbb.mp4"
    file = requests.get(url).content
    st.video(file)


@st.cache_data
def code():
    st.code("print('Hello, world!')", width=300, height=200)


audio()
video()

if st.checkbox("Show code", True):
    code()


@st.cache_data
def image():
    img: npt.NDArray[np.int64] = np.repeat(0, 10000).reshape(100, 100)
    st.image(img, caption="A black square", width=200)


if st.checkbox("Show image", True):
    image()


# Keep the background-refresh scenario opt-in so its warning and display output don't
# interfere with the other cache_data tests in this app.
_BACKGROUND_REFRESH_TTL_SECONDS = 8

if "cache_data_background_refresh_key" not in st.session_state:
    st.session_state.cache_data_background_refresh_key = uuid.uuid4().hex


@st.cache_resource(show_spinner=False)
def background_refresh_execution_counter(
    session_key: str,  # noqa: ARG001 - Parameter is the per-session cache key.
) -> dict[str, int]:
    return {"count": 0}


@st.cache_data(
    ttl=_BACKGROUND_REFRESH_TTL_SECONDS,
    refresh_mode="background",
    show_spinner=False,
)
def background_refresh_value(session_key: str) -> int:
    counter = background_refresh_execution_counter(session_key)
    counter["count"] += 1
    return counter["count"]


@st.cache_data(
    ttl=_BACKGROUND_REFRESH_TTL_SECONDS,
    refresh_mode="background",
    show_spinner=False,
)
def background_refresh_with_display(session_key: str) -> None:  # noqa: ARG001
    st.markdown("Inside background cache_data function")


if st.button("Run cache_data background refresh test"):
    st.session_state.run_cache_data_background_refresh_test = True

if st.session_state.get("run_cache_data_background_refresh_test", False):
    background_refresh_key = st.session_state.cache_data_background_refresh_key
    st.markdown(
        f"Background refresh value: {background_refresh_value(background_refresh_key)}"
    )
    background_refresh_with_display(background_refresh_key)
