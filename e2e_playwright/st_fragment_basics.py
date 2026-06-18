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

from datetime import date
from uuid import uuid4

import streamlit as st


# Write a bunch of widgets so that we can interact with them and verify that only the
# uuid within the fragment changes in the script run.
# NOTE: We intentionally don't verify that values returned by these widgets work as
# expected as doing so in this type of batch test would drastically increase the
# boilerplate code required to write this. Instead, we rely on other tests to fully test
# return values. We also don't test the audio_input, camera_input, data_editor, and
# file_uploader widgets as well as custom components here due to the disproportionate
# amount of work required to do so.
@st.fragment
def my_big_fragment():
    st.button("a button")
    st.download_button("a download button", b"")
    st.chat_input("a chat input")
    st.checkbox("a checkbox")
    st.color_picker("a color picker")
    st.date_input("a date input", date(1970, 1, 1), min_value=date(1970, 1, 1))
    st.multiselect("a multiselect", ["a", "b", "c"])
    st.number_input("a number input")
    st.radio("a radio", ["a", "b", "c"])
    st.selectbox("a selectbox", ["a", "b", "c"])
    st.slider("a slider")
    st.text_area("a text area")
    st.text_input("a text input")
    st.time_input("a time input")

    st.write(f"inside fragment: {uuid4()}")


my_big_fragment()

st.write(f"outside: fragment {uuid4()}")


# --- Scenarios for fragments writing into containers created outside of them. ---

# A static outside container (no changing content) used to snapshot the transparent
# wrapper: its children must be direct flex items of the outside container with no
# extra border or padding introduced by the wrapper. Declared early so the fixed
# st.bottom container can't overlap it in the snapshot.
visual_container = st.container(key="visual_container")
with visual_container:
    st.markdown("visual header")


@st.fragment
def visual_fragment():
    with visual_container:
        st.markdown("visual fragment")


visual_fragment()
with visual_container:
    st.markdown("visual footer")

# A single outside container that receives a main-script header before the fragment
# runs, the fragment's own writes, and a main-script footer after the fragment runs.
# The header and footer must keep their slots across fragment reruns, while the
# fragment's content updates in place.
outside_interleaved = st.container(key="outside_interleaved")
with outside_interleaved:
    st.markdown("interleaved header")


@st.fragment
def interleaved_fragment():
    st.button("rerun interleaved", key="rerun_interleaved")
    with outside_interleaved:
        st.markdown(f"interleaved fragment: {uuid4()}")


interleaved_fragment()
with outside_interleaved:
    st.markdown("interleaved footer")


# Two fragments writing into the same outside container, interleaved with non-fragment
# writes. Each fragment gets its own wrapper, and the non-fragment writes keep their
# position when either fragment reruns.
two_fragments_container = st.container(key="two_fragments_container")
with two_fragments_container:
    st.markdown("two-fragments header")


@st.fragment
def first_writer_fragment():
    st.button("rerun first writer", key="rerun_first_writer")
    with two_fragments_container:
        st.markdown(f"first writer fragment: {uuid4()}")


@st.fragment
def second_writer_fragment():
    st.button("rerun second writer", key="rerun_second_writer")
    with two_fragments_container:
        st.markdown(f"second writer fragment: {uuid4()}")


first_writer_fragment()
with two_fragments_container:
    st.markdown("two-fragments middle")
second_writer_fragment()
with two_fragments_container:
    st.markdown("two-fragments footer")


# A fragment writing into the sidebar, both via a ``with st.sidebar:`` block and
# directly via ``st.sidebar``. Main-script writes provide a header before and a footer
# after the fragment.
st.sidebar.markdown("sidebar header")


@st.fragment
def sidebar_fragment():
    st.button("rerun sidebar", key="rerun_sidebar")
    with st.sidebar:
        st.markdown(f"sidebar with-block: {uuid4()}")
    st.sidebar.markdown(f"sidebar direct: {uuid4()}")


sidebar_fragment()
st.sidebar.markdown("sidebar footer")


# A fragment writing directly into the bottom container, with main-script writes
# providing a header before and a footer after.
st.bottom.markdown("bottom header")


@st.fragment
def bottom_fragment():
    st.button("rerun bottom", key="rerun_bottom")
    st.bottom.markdown(f"bottom fragment: {uuid4()}")


bottom_fragment()
st.bottom.markdown("bottom footer")


# The ``outside.empty()`` placeholder pattern: claim the slot during the full run, then
# fill it from the fragment on each rerun.
empty_container = st.container(key="empty_container")
with empty_container:
    st.markdown("empty-pattern header")
    empty_placeholder = st.empty()


@st.fragment
def empty_pattern_fragment():
    st.button("rerun empty pattern", key="rerun_empty_pattern")
    empty_placeholder.markdown(f"empty placeholder: {uuid4()}")


empty_pattern_fragment()


# A nested container created inside the fragment, within an outside container.
nested_container = st.container(key="nested_container")
with nested_container:
    st.markdown("nested header")


@st.fragment
def nested_fragment():
    st.button("rerun nested", key="rerun_nested")
    with nested_container:
        inner = st.container()
        with inner:
            st.markdown(f"nested fragment: {uuid4()}")


nested_fragment()


# A fragment writing a variable number of elements into an outside container,
# with a main-script footer after the fragment. Shrinking the count must garbage-
# collect the removed elements (no stale rows), while growing must not overwrite
# the footer.
shrink_container = st.container(key="shrink_container")
with shrink_container:
    st.markdown("shrink header")

if "shrink_count" not in st.session_state:
    st.session_state.shrink_count = 5


@st.fragment
def shrink_fragment():
    if st.button("shrink rows", key="shrink_rows"):
        st.session_state.shrink_count = 2
    if st.button("grow rows", key="grow_rows"):
        st.session_state.shrink_count = 5
    with shrink_container:
        for i in range(st.session_state.shrink_count):
            st.markdown(f"shrink row {i}")


shrink_fragment()
with shrink_container:
    st.markdown("shrink footer")
