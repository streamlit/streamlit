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

import streamlit as st

# Test 1: on_dismiss="rerun" functionality
st.header("Dialog on_dismiss='rerun' Test")


@st.dialog("Test Dialog - Rerun", on_dismiss="rerun")
def test_dialog_rerun():
    st.write("Dialog content for rerun test")
    st.text_input("Enter something")

    if st.button("Close with button", key="close-rerun-btn"):
        st.rerun()


if st.button("Open Rerun Dialog"):
    test_dialog_rerun()

# Use a counter to detect reruns caused by dialog dismiss
if "rerun_count" not in st.session_state:
    st.session_state.rerun_count = 0

# This will be incremented on every rerun, including when dialog is dismissed
st.session_state.rerun_count += 1
st.write(f"Rerun count: {st.session_state.rerun_count}")

st.divider()

# Test 2: on_dismiss with callback function
st.header("Dialog on_dismiss with Callback Test")


def on_dialog_dismiss():
    st.session_state.callback_executed = True
    st.session_state.dismiss_count = st.session_state.get("dismiss_count", 0) + 1


@st.dialog("Test Dialog - Callback", on_dismiss=on_dialog_dismiss)
def test_dialog_callback():
    st.write("Dialog content for callback test")
    st.text_input("Enter something else")

    if st.button("Close with button", key="close-callback-btn"):
        st.rerun()


if st.button("Open Callback Dialog"):
    test_dialog_callback()

if st.session_state.get("callback_executed"):
    st.success(f"Callback executed {st.session_state.get('dismiss_count', 0)} times!")

st.divider()

# Test 3: on_dismiss="ignore" (default behavior)
st.header("Dialog on_dismiss='ignore' Test")


@st.dialog("Test Dialog - Ignore", on_dismiss="ignore")  # explicit ignore
def test_dialog_ignore():
    st.write("Dialog content for ignore test")
    st.text_input("This dialog ignores dismiss events")

    if st.button("Close with button", key="close-ignore-btn"):
        st.rerun()


if st.button("Open Ignore Dialog"):
    test_dialog_ignore()

st.write(
    "Note: Dismissing the 'ignore' dialog should not cause any rerun or callback execution."
)

st.divider()

# Test 4: Non-dismissible dialog (should not trigger on_dismiss)
st.header("Non-dismissible Dialog Test")


@st.dialog("Non-dismissible Dialog", dismissible=False, on_dismiss="rerun")
def test_non_dismissible_dialog():
    st.write("This dialog cannot be dismissed by clicking outside or pressing ESC")
    st.info("You can only close this dialog by clicking 'Close' below.")

    if st.button("Close", key="close-non-dismissible-btn"):
        st.rerun()


if st.button("Open Non-dismissible Dialog"):
    test_non_dismissible_dialog()

st.write(
    "Note: Non-dismissible dialogs should not trigger on_dismiss events when trying to dismiss them."
)

# Display some debug information
st.divider()
st.header("Debug Information")
st.write("Session State:")
st.json(dict(st.session_state))
