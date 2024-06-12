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

import numpy as np
import requests

import streamlit as st

st.button("click to rerun")

side_effects = []


@st.cache_data(experimental_allow_widgets=True)
def foo():
    side_effects.append("function ran")
    r = st.radio("radio", ["foo", "bar", "baz", "qux"], index=1)
    return r


foo()

st.text(side_effects)


@st.cache_data
def with_cached_widget_warning():
    st.write("Cached function that should show a widget usage warning.")
    st.selectbox("selectbox", ["foo", "bar", "baz", "qux"], index=1)


if st.button("Run cached function with widget warning"):
    with_cached_widget_warning()


@st.cache_data(experimental_allow_widgets=True)
def inner_cache_function():
    st.radio("radio 2", ["foo", "bar", "baz", "qux"], index=1)


@st.cache_data(experimental_allow_widgets=False)
def nested_cached_function():
    inner_cache_function()
    st.selectbox("selectbox 2", ["foo", "bar", "baz", "qux"], index=1)


if st.button("Run nested cached function with widget warning"):
    # When running nested_cached_function(), we get two warnings, one from nested_cached_function()
    # and one from inner_cache_function. inner_cache_function() on its own would allow the
    # widget usage, but since it is nested in the other function that does not allow it, we don't allow it.
    # The outer experimental_allow_widgets=False will always take priority.
    # Otherwise, we would need to recompute the outer cached function whenever
    # the widget in the inner function is used. Which we don't want to do when
    # experimental_allow_widgets is set to False.
    nested_cached_function()


if "run_counter" not in st.session_state:
    st.session_state.run_counter = 0


@st.cache_data
def replay_element():
    st.session_state.run_counter += 1
    st.markdown(f"Cache executions: {st.session_state.run_counter}")
    return st.session_state.run_counter


if st.button("Cached function with element replay"):
    st.write("Cache return", replay_element())


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


audio()
video()


@st.cache_data
def image():
    img = np.repeat(0, 10000).reshape(100, 100)
    st.image(img, caption="A black square", width=200)


if st.checkbox("Show image", True):
    image()
