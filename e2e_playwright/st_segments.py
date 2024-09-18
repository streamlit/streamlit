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

import streamlit as st

with st.sidebar:
    st.markdown(
        """
        - [Multi Select - Segments](#multi-select-segments)
        - [Single Select - Segments](#single-select-segments)
        - [Icon-only button group - Segments](#icon-only-button-group-segments)
        - [on_change callback - Segments](#on-change-callback-segments)
        - [Disabled - Segments](#disabled-segments)
        - [Segments in form](#segments-in-form)
        - [Segments in fragment](#segments-in-fragment)
        - [Unmounted - Segments](#unmounted-segments)
        """
    )

st.header("Multi Select - Segments", anchor="multi-select-segments")
with st.echo(code_location="below"):
    if st.checkbox("Set default values", value=False):
        st.session_state.default_segments_options = [
            "Foobar",
            "🧰 General widgets",
        ]
    else:
        st.session_state.default_segments_options = []

    default = st.session_state.default_segments_options

    selection = st.segments(
        "select some options",
        [
            ":material/star: Hello there!",
            "Foobar",
            "Icon in the end: :material/rocket:",
            ":material/thumb_up: Hello again!",
            "🧰 General widgets",
            "📊 Charts",
            "🌇 Images",
            "🎥 Video",
            "📝 Text",
            "This is a very long text 📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝, yes, long long long long text",
        ],
        key="segments",
        selection_mode="multi",
        default=default,
        help="You can choose multiple options",
    )

    st.write(f"Multi selection: {selection}")


st.header("Single Select - Segments", anchor="single-select-segments")
with st.echo(code_location="below"):
    selection = st.segments(
        "select an option",
        [
            ":material/star: Hello there!",
            "Foobar",
            "Icon in the end: :material/rocket:",
        ],
        selection_mode="single",
    )
    st.write(f"Single selection: {selection}")


st.header("Icon-only button group - Segments", anchor="icon-only-button-group-segments")
with st.echo(code_location="below"):
    selection = st.segments(
        "select an icon",
        options=[0, 1, 2, 3],
        icons=[
            ":material/add:",
            ":material/zoom_in:",
            ":material/zoom_out:",
            ":material/zoom_out_map:",
        ],
        format_func=lambda x: "",
        selection_mode="single",
    )
    st.write(f"Single icon selection: {selection}")


st.header("on_change callback - Segments", anchor="on-change-callback-segments")
with st.echo(code_location="below"):
    st.segments(
        "Emotions",
        ["Joy", "Sadness", "Anger", "Disgust"],
        key="segments_on_change",
        on_change=lambda: st.write(
            f"on_change selection: {st.session_state.segments_on_change}"
        ),
    )


st.header("Disabled - Segments", anchor="disabled-segments")
with st.echo(code_location="below"):
    selection = st.segments(
        "Emotions",
        ["Joy", "Sadness", "Anger", "Disgust"],
        key="segments_disabled",
        disabled=True,
    )
    st.write("segments-disabled:", str(selection))


st.header("Segments in form", anchor="segments-in-form")
with st.echo(code_location="below"):
    with st.form(key="my_form", clear_on_submit=True):
        selection = st.segments(
            "Emotions",
            ["Joy", "Sadness", "Anger", "Disgust"],
            key="segments_in_form",
            selection_mode="multi",
        )
        st.form_submit_button("Submit")
    st.write(
        "segments-in-form:",
        str(st.session_state.segments_in_form),
    )


st.header("Segments in fragment", anchor="segments-in-fragment")
with st.echo(code_location="below"):

    @st.experimental_fragment()
    def test_fragment():
        selection = st.segments(
            "Emotions",
            ["Joy", "Sadness", "Anger", "Disgust"],
            key="segments_in_fragment",
        )
        st.write("segments-in-fragment:", str(selection))

    test_fragment()


st.header("Unmounted - Segments", anchor="unmounted-segments")
with st.echo(code_location="below"):
    if st.button("Create some elements to unmount component"):
        for _ in range(2):
            # The sleep here is needed, because it won't unmount the
            # component if this is too fast.
            time.sleep(1)
            st.write("Another element")

    selection = st.segments(
        "Emotions", ["Joy", "Sadness", "Anger", "Disgust"], key="segments_after_sleep"
    )
    st.write("segments-after-sleep:", str(selection))


if "runs" not in st.session_state:
    st.session_state.runs = 0
st.session_state.runs += 1
st.write("Runs:", st.session_state.runs)
