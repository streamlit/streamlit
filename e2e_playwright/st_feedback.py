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

import time

import streamlit as st

with st.container(key="thumbs_container"):
    st.feedback()
    st.session_state.thumbs_feedback_disabled = 1
    st.feedback(key="thumbs_feedback_disabled", disabled=True)
    st.feedback(key="thumbs_feedback_hover_test")


with st.container(key="faces_container"):
    st.feedback(
        "faces",
        key="faces_feedback",
        on_change=lambda: st.write(
            f"Faces sentiment: {st.session_state.faces_feedback_disabled}"
        ),
    )
    st.session_state.faces_feedback_disabled = 3
    st.feedback(
        "faces",
        key="faces_feedback_disabled",
        disabled=True,
    )
    st.feedback("faces", key="faces_feedback_hover_test")

with st.container(key="stars_container"):
    sentiment = st.feedback("stars")
    st.write(f"Star sentiment: {sentiment}")
    st.session_state.star_feedback_disabled = 3
    sentiment = st.feedback("stars", disabled=True, key="star_feedback_disabled")
    st.write("feedback-disabled:", str(sentiment))
    st.feedback("stars", key="stars_feedback_hover_test")


with st.form(key="my_form", clear_on_submit=True):
    sentiment = st.feedback()
    st.form_submit_button("Submit")

st.write("feedback-in-form:", str(sentiment))


@st.fragment
def test_fragment():
    sentiment = st.feedback(key="fragment_feedback")
    st.write("feedback-in-fragment:", str(sentiment))


test_fragment()


if st.button("Create some elements to unmount component"):
    for _ in range(3):
        # The sleep here is needed, because it won't unmount the
        # component if this is too fast.
        time.sleep(1)
        st.write("Another element")

sentiment = st.feedback(key="after_sleep_feedback")
st.write("feedback-after-sleep:", str(sentiment))

st.subheader("Thumbs with different widths")
st.feedback("thumbs", width="content", key="thumbs_content_width")
st.feedback("thumbs", width="stretch", key="thumbs_stretch_width")
st.feedback("thumbs", width=300, key="thumbs_300px_width")

if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
