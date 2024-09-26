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
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

np.random.seed(0)
data = np.random.randint(low=0, high=20, size=(20, 3))


@st.dialog("Test Dialog with Images")
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


@st.dialog("Simple Dialog")
def simple_dialog():
    st.write("Hello again!")
    st.text_input("Enter something!")

    if st.button("Submit", key="dialog2-btn"):
        st.rerun()


if st.button("Open Dialog without Images"):
    simple_dialog()


@st.dialog("Large-width Dialog", width="large")
def large_width_dialog():
    st.write("This dialog has a large width.")

    if st.button("Submit", key="dialog4-btn"):
        st.rerun()


if st.button("Open large-width Dialog"):
    large_width_dialog()


@st.dialog("Dialog with headings")
def headings_dialog():
    st.header("Header", help="Some tooltip!")


if st.button("Open headings Dialog"):
    headings_dialog()

# We use this dialog for a screenshot test as loading images via the browser
# is non-deterministic
with st.sidebar:

    @st.dialog("Simple Dialog in Sidebar")
    def dialog_in_sidebar():
        st.write("Hello sidebar dialog!")

        if st.button("Submit", key="dialog5-btn"):
            st.rerun()

    if st.button("Open Sidebar-Dialog"):
        dialog_in_sidebar()


@st.dialog("Submit-button Dialog")
def submit_button_dialog():
    st.write("This dialog has a submit button.")
    st.write(f"Fragment Id: {get_script_run_ctx().current_fragment_id}")

    if st.button("Submit", key="dialog6-btn"):
        st.rerun()


if st.button("Open submit-button Dialog"):
    submit_button_dialog()


@st.dialog("Level2 Dialog")
def level2_dialog():
    st.write("Second level dialog")


@st.dialog("Level1 Dialog")
def level1_dialog():
    st.write("First level dialog")
    st.write(f"Fragment Id: {get_script_run_ctx().current_fragment_id}")
    level2_dialog()


if st.button("Open Nested Dialogs"):
    level1_dialog()


@st.dialog("Dialog with error")
def dialog_with_error():
    with st.form(key="forecast_form"):
        # key is an invalid argument, so this shows an error
        st.form_submit_button("Submit", key="foo")


if st.button("Open Dialog with Key Error"):
    dialog_with_error()


@st.dialog("Dialog with copy buttons")
def dialog_with_copy_buttons():
    st.json([1, 2, 3])

    copied_text = st.text_input("Enter copied text")
    st.write(copied_text)


if st.button("Open Dialog with Copy Buttons"):
    dialog_with_copy_buttons()


@st.experimental_dialog("Usage of deprecated experimental_dialog")
def dialog_with_deprecation_warning():
    pass  # No need to write anything in the dialog body.


if st.button("Open Dialog with deprecation warning"):
    dialog_with_deprecation_warning()


@st.fragment()
def fragment():
    if st.button("Fragment Button"):
        st.write("Fragment Button clicked")


fragment()


@st.dialog("Dialog with chart")
def dialog_with_chart():
    st.write("This dialog has a chart")
    st.bar_chart(pd.DataFrame(data, columns=["a", "b", "c"]))


if st.button("Open Chart Dialog"):
    dialog_with_chart()
