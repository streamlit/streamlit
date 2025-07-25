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

import numpy as np
import pandas as pd

import streamlit as st
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx

np.random.seed(0)
data = np.random.randint(low=0, high=20, size=(20, 3))


@st.dialog("Test Dialog with Images")
def dialog_with_images() -> None:
    st.write("Hello!")
    st.slider("Slide me!", 0, 10)

    # render a dataframe
    st.dataframe(
        pd.DataFrame(np.zeros((1000, 6)), columns=["A", "B", "C", "D", "E", "F"])
    )

    st.subheader("Images", help="Some images are generated")
    # render multiple images. This will make the Close button to go out of
    # screen and allows scrollability of the dialog
    for _ in range(3):
        st.image(np.repeat(0, 1000000).reshape(1000, 1000))

    if st.button("Submit", key="dialog-btn"):
        st.rerun()


if st.button("Open Dialog with Images"):
    dialog_with_images()


@st.dialog("Simple Dialog")
def simple_dialog() -> None:
    st.write("Hello again!")
    st.text_input("Enter something!")

    if st.button("Submit", key="dialog2-btn"):
        st.rerun()


if st.button("Open Dialog without Images"):
    simple_dialog()


@st.dialog("Large-width Dialog", width="large")
def large_width_dialog() -> None:
    st.write("This dialog has a large width.")

    if st.button("Submit", key="dialog4-btn"):
        st.rerun()


if st.button("Open large-width Dialog"):
    large_width_dialog()


@st.dialog("Dialog with headings")
def headings_dialog() -> None:
    st.header("Header", help="Some tooltip!")


if st.button("Open headings Dialog"):
    headings_dialog()

# We use this dialog for a screenshot test as loading images via the browser
# is non-deterministic
with st.sidebar:

    @st.dialog("Simple Dialog in Sidebar")
    def dialog_in_sidebar() -> None:
        st.write("Hello sidebar dialog!")

        if st.button("Submit", key="dialog5-btn"):
            st.rerun()

    if st.button("Open Sidebar-Dialog"):
        dialog_in_sidebar()


@st.dialog("Submit-button Dialog")
def submit_button_dialog() -> None:
    st.write("This dialog has a submit button.")
    st.write(f"Fragment Id: {get_script_run_ctx().current_fragment_id}")  # type: ignore[union-attr]

    if st.button("Submit", key="dialog6-btn"):
        st.rerun()


if st.button("Open submit-button Dialog"):
    submit_button_dialog()


@st.dialog("Level2 Dialog")
def level2_dialog() -> None:
    st.write("Second level dialog")


@st.dialog("Level1 Dialog")
def level1_dialog() -> None:
    st.write("First level dialog")
    st.write(f"Fragment Id: {get_script_run_ctx().current_fragment_id}")  # type: ignore[union-attr]
    level2_dialog()


if st.button("Open Nested Dialogs"):
    level1_dialog()


@st.dialog("Dialog with error")
def dialog_with_error() -> None:
    with st.form(key="forecast_form"):
        # key is an invalid argument, so this shows an error
        st.form_submit_button("Submit", key="foo")  # type: ignore[call-arg]


if st.button("Open Dialog with Key Error"):
    dialog_with_error()


@st.dialog("Dialog with copy buttons")
def dialog_with_copy_buttons() -> None:
    st.json([1, 2, 3])

    copied_text = st.text_input("Enter copied text")
    st.write(copied_text)


if st.button("Open Dialog with Copy Buttons"):
    dialog_with_copy_buttons()


@st.experimental_dialog("Usage of deprecated experimental_dialog")
def dialog_with_deprecation_warning() -> None:
    pass  # No need to write anything in the dialog body.


if st.button("Open Dialog with deprecation warning"):
    dialog_with_deprecation_warning()


@st.fragment()
def fragment() -> None:
    if st.button("Fragment Button"):
        st.write("Fragment Button clicked")


fragment()


@st.dialog("Dialog with chart")
def dialog_with_chart() -> None:
    st.write("This dialog has a chart")
    st.bar_chart(pd.DataFrame(data, columns=["a", "b", "c"]))


if st.button("Open Chart Dialog"):
    dialog_with_chart()


@st.dialog("Dialog with dataframe")
def dialog_with_dataframe() -> None:
    st.dataframe(
        pd.DataFrame(data, columns=["a", "b", "c"]),
        column_config={
            "a": st.column_config.Column(width="small"),
            "b": st.column_config.Column(width="small"),
            "c": st.column_config.Column(width="small"),
        },
        hide_index=True,
    )


if st.button("Open Dialog with dataframe"):
    dialog_with_dataframe()


@st.dialog("Dialog with rerun")
def dialog_with_rerun() -> None:
    if st.button("Close Dialog"):
        time.sleep(0.15)
        st.rerun()


if st.button("Open Dialog with rerun"):
    dialog_with_rerun()


@st.dialog(
    "This is a very long dialog title that should not overlap with the close button"
)
def dialog_with_long_title() -> None:
    st.write("This dialog has a very long title to test spacing.")


if st.button("Open Dialog with long title"):
    dialog_with_long_title()


@st.dialog("Non-dismissible Dialog", dismissible=False)
def non_dismissible_dialog() -> None:
    st.write("This dialog cannot be dismissed by pressing ESC or clicking outside!")
    st.info(
        "You can only close this dialog by clicking the 'Close Dialog' button below."
    )

    if st.button("Close Dialog", key="non-dismissible-close-btn"):
        st.rerun()


if st.button("Open Non-dismissible Dialog"):
    non_dismissible_dialog()


st.divider()
st.subheader("Dialog on_dismiss Tests")

# Counter for tracking reruns caused by on_dismiss
if "rerun_count" not in st.session_state:
    st.session_state.rerun_count = 0
st.session_state.rerun_count += 1
st.write(f"Rerun count: {st.session_state.rerun_count}")


@st.dialog("Dialog with on_dismiss=rerun", on_dismiss="rerun")
def dialog_on_dismiss_rerun():
    st.write("This dialog triggers rerun on dismiss")
    if st.button("Close", key="close-rerun-dialog"):
        st.rerun()


if st.button("Open on_dismiss=rerun Dialog"):
    dialog_on_dismiss_rerun()


def on_dialog_dismiss_callback():
    """Callback function for on_dismiss test."""
    st.session_state.callback_executed = True
    st.session_state.dismiss_count = st.session_state.get("dismiss_count", 0) + 1


@st.dialog("Dialog with on_dismiss callback", on_dismiss=on_dialog_dismiss_callback)
def dialog_on_dismiss_callback():
    st.write("This dialog executes callback on dismiss")
    if st.button("Close", key="close-callback-dialog"):
        st.rerun()


if st.button("Open on_dismiss callback Dialog"):
    dialog_on_dismiss_callback()

if st.session_state.get("callback_executed"):
    st.write("Callback executions:", st.session_state.get("dismiss_count", 0))
