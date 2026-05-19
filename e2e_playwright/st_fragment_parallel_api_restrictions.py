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

"""Test apps for parallel fragment API restrictions."""

import streamlit as st

test_mode = st.query_params.get("test", "dialog_block")


# Test 1: Dialog blocked during initial run
if test_mode == "dialog_block":

    @st.dialog("Test Dialog")
    def my_dialog():
        st.write("Dialog content")

    @st.fragment(parallel=True)
    def parallel_fragment_with_dialog():
        st.write("Fragment content")
        my_dialog()

    parallel_fragment_with_dialog()


# Test 2: switch_page blocked during initial run
elif test_mode == "switch_page_block":

    @st.fragment(parallel=True)
    def parallel_fragment_with_switch():
        st.write("Fragment content")
        st.switch_page("pages/other.py")

    parallel_fragment_with_switch()


# Test 3: Dialog allowed on rerun (button click)
elif test_mode == "dialog_allow_rerun":

    @st.dialog("Test Dialog")
    def my_dialog():
        st.write("Dialog opened successfully")

    @st.fragment(parallel=True)
    def parallel_fragment_with_button_dialog():
        st.write("Fragment content")
        if st.button("Open Dialog", key="open_dialog_btn"):
            my_dialog()

    parallel_fragment_with_button_dialog()


# Test 4: Nested sequential fragment blocks dialog during parallel batch
elif test_mode == "nested_sequential_block":

    @st.dialog("Test Dialog")
    def my_dialog():
        st.write("Dialog content")

    @st.fragment
    def inner_sequential_fragment():
        st.write("Inner fragment")
        my_dialog()

    @st.fragment(parallel=True)
    def outer_parallel_fragment():
        st.write("Outer fragment")
        inner_sequential_fragment()

    outer_parallel_fragment()


# Test 5: Nested parallel fragments both restricted
elif test_mode == "nested_parallel_block":

    @st.dialog("Test Dialog")
    def my_dialog():
        st.write("Dialog content")

    @st.fragment(parallel=True)
    def inner_parallel_fragment():
        st.write("Inner parallel fragment")
        my_dialog()

    @st.fragment(parallel=True)
    def outer_parallel_fragment():
        st.write("Outer parallel fragment")
        inner_parallel_fragment()

    outer_parallel_fragment()


# Test 6: Nested parallel fragment allows dialog on rerun
elif test_mode == "nested_parallel_allow_rerun":

    @st.dialog("Test Dialog")
    def my_dialog():
        st.write("Nested dialog opened successfully")

    @st.fragment(parallel=True)
    def inner_parallel_fragment():
        st.write("Inner fragment")
        if st.button("Open Nested Dialog", key="nested_dialog_btn"):
            my_dialog()

    @st.fragment(parallel=True)
    def outer_parallel_fragment():
        st.write("Outer fragment")
        inner_parallel_fragment()

    outer_parallel_fragment()
