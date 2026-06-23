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


# A fragment with a keyed slider to verify widget values persist across full reruns.
@st.fragment
def widget_persistence_fragment():
    val = st.slider("Fragment slider", 0, 100, 50, key="frag_slider")
    st.markdown(f"slider value: {val}")


widget_persistence_fragment()

st.markdown(f"app uuid: {uuid4()}")
st.button("Trigger full rerun", key="full_rerun_btn")


# A form inside a fragment to verify form submission works correctly.
@st.fragment
def form_fragment():
    with st.form("frag_form"):
        user_input = st.text_input("Name", key="form_name")
        submitted = st.form_submit_button("Submit form")

    if submitted:
        st.markdown(f"submitted: {user_input}")
    else:
        st.markdown("not submitted")


form_fragment()


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


# A fragment with several in-scope elements and a rerun button.
@st.fragment
def stable_content_fragment():
    st.markdown("stable item A")
    st.markdown("stable item B")
    st.markdown("stable item C")
    st.button("rerun stable", key="rerun_stable")


stable_content_fragment()
