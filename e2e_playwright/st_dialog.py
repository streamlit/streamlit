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
import pandas as pd

import streamlit as st


@st.experimental_dialog("Test Dialog with Images")
def dialog_with_images():
    st.write("Hello!")
    st.slider("Slide me!", 0, 10)

    # render a dataframe
    st.dataframe(
        pd.DataFrame(np.zeros((1000, 6)), columns=["A", "B", "C", "D", "E", "F"])
    )

    st.subheader("Images", help="Some images are generated")
    # render multiple images. This will make the Close button to go out of
    # screen and allows scrollability of the dialog
    for _ in range(0, 3):
        st.image(np.repeat(0, 1000000).reshape(1000, 1000))

    if st.button("Submit", key="dialog-btn"):
        st.rerun()


if st.button("Open Dialog with Images"):
    dialog_with_images()


@st.experimental_dialog("Simple Dialog")
def simple_dialog():
    st.write("Hello again!")
    st.text_input("Enter something!")

    if st.button("Submit", key="dialog2-btn"):
        st.rerun()


if st.button("Open Dialog without Images"):
    simple_dialog()


@st.experimental_dialog("Large-width Dialog", width="large")
def large_width_dialog():
    st.write("This dialog has a large width.")

    if st.button("Submit", key="dialog4-btn"):
        st.rerun()


if st.button("Open large-width Dialog"):
    large_width_dialog()


@st.experimental_dialog("Dialog with headings")
def headings_dialog():
    st.header("Header", help="Some tooltip!")


if st.button("Open headings Dialog"):
    headings_dialog()

# We use this dialog for a screenshot test as loading images via the browser
# is non-deterministic
with st.sidebar:

    @st.experimental_dialog("Simple Dialog in Sidebar")
    def dialog_in_sidebar():
        st.write("Hello sidebar dialog!")

        if st.button("Submit", key="dialog5-btn"):
            st.rerun()

    if st.button("Open Sidebar-Dialog"):
        dialog_in_sidebar()


@st.experimental_dialog("Level2 Dialog")
def level2_dialog():
    st.write("Second level dialog")


@st.experimental_dialog("Level1 Dialog")
def level1_dialog():
    st.write("First level dialog")
    level2_dialog()


if st.button("Open Nested Dialogs"):
    level1_dialog()
