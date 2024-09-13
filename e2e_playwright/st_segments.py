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

import streamlit as st

with st.sidebar:
    st.header("Settings")

st.header("Multi Select - Segments")
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
            "This is a very long text 📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝📝",
        ],
        key="segments",
        selection_mode="multi",
        default=default,
        help="You can choose multiple options",
    )

    st.write(f"Multi selection: {selection}")


st.header("Single Select - Segments")
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


st.header("Icon-only button group - Segments")
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
