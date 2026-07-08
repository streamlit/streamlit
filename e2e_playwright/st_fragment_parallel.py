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

"""Test app for parallel fragments feature."""

import time

import streamlit as st

test_mode = st.query_params.get("test", "default")

if "fragment_a_count" not in st.session_state:
    st.session_state.fragment_a_count = 0
if "fragment_b_count" not in st.session_state:
    st.session_state.fragment_b_count = 0
if "counter" not in st.session_state:
    st.session_state.counter = 0
if "start_time" not in st.session_state:
    st.session_state.start_time = time.time()
if "run_count" not in st.session_state:
    st.session_state.run_count = 0

st.session_state.run_count += 1

# Default mode: Core parallel fragment tests (concurrent rendering, widgets, etc.)
if test_mode == "default":

    @st.fragment(parallel=True)
    def slow_fragment_1():
        time.sleep(0.3)
        st.write("Fragment 1 done")

    @st.fragment(parallel=True)
    def slow_fragment_2():
        time.sleep(0.2)
        st.write("Fragment 2 done")

    @st.fragment(parallel=True)
    def slow_fragment_3():
        time.sleep(0.1)
        st.write("Fragment 3 done")

    @st.fragment(parallel=True)
    def fragment_with_button():
        if st.button("Click me", key="parallel_btn"):
            st.session_state.counter += 1
        st.write(f"Counter: {st.session_state.counter}")

    @st.fragment(parallel=True)
    def fragment_a():
        st.session_state.fragment_a_count += 1
        st.button("Rerun A", key="btn_a")
        st.write(f"Fragment A ran {st.session_state.fragment_a_count} times")

    @st.fragment(parallel=True)
    def fragment_b():
        st.session_state.fragment_b_count += 1
        st.button("Rerun B", key="btn_b")
        st.write(f"Fragment B ran {st.session_state.fragment_b_count} times")

    @st.fragment(parallel=True)
    def container_test_fragment():
        """Fragment for container inspection - uses key for targeting."""
        st.write("Container test content")

    st.header("Parallel Fragments Test App")

    st.subheader("Concurrent Rendering Test")
    st.session_state.start_time = time.time()
    # Invocation order deliberately not 1 → 2 → 3 so ordering tests prove DOM follows
    # call order (pre-allocated placeholders), not definition or label numbering.
    slow_fragment_3()
    slow_fragment_1()
    slow_fragment_2()
    elapsed = time.time() - st.session_state.start_time
    st.write("All fragments dispatched")
    st.write(f"Dispatch time: {elapsed:.2f}s")

    st.subheader("Widget Interaction Test")
    fragment_with_button()
    st.write(f"Outside counter: {st.session_state.counter}")

    st.subheader("Fragment Rerun Test")
    fragment_a()
    fragment_b()

    st.subheader("Container Test")
    with st.container(key="container_test_section"):
        container_test_fragment()


# API Restrictions Tests
# Test 1: Dialog blocked during initial run
elif test_mode == "dialog_block":

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


# Cancellation Tests
# Test 7: st.stop ends script, doesn't wait for slow fragment
elif test_mode == "st_stop":
    start_time = time.time()

    @st.fragment(parallel=True)
    def fragment_a():
        st.write("Fragment A content")
        st.stop()

    @st.fragment(parallel=True)
    def fragment_b():
        st.session_state.fragment_b_started = True
        time.sleep(0.3)
        st.write("Fragment B done after sleep")

    fragment_a()
    fragment_b()

    elapsed = time.time() - start_time
    st.write(f"Total time: {elapsed:.1f}s")


# Test 8: st.rerun restarts app
elif test_mode == "st_rerun":

    @st.fragment(parallel=True)
    def fragment_with_rerun():
        if st.session_state.run_count == 1:
            st.session_state.run_count = 2
            st.rerun()
        else:
            st.write("App restarted successfully")

    fragment_with_rerun()
    st.write(f"Run count: {st.session_state.run_count}")


# Test 9: Widget interaction during parallel execution
elif test_mode == "widget_interaction":

    @st.fragment(parallel=True)
    def fast_fragment():
        time.sleep(0.2)
        if st.button("Increment", key="increment_btn"):
            st.session_state.counter += 1
        st.write(f"Counter: {st.session_state.counter}")

    @st.fragment(parallel=True)
    def slow_fragment():
        time.sleep(0.5)
        st.write("Slow fragment done")

    fast_fragment()
    slow_fragment()


# Test 10: Error renders in correct container
elif test_mode == "error_container":

    @st.fragment(parallel=True)
    def fragment_with_error():
        st.write("Before error")
        raise ValueError("Test error in fragment")

    @st.fragment(parallel=True)
    def fragment_success():
        st.write("Fragment B success")

    fragment_with_error()
    fragment_success()
