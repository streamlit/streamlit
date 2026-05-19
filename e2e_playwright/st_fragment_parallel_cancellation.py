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

"""Test apps for parallel fragment cancellation behavior."""

import time

import streamlit as st

test_mode = st.query_params.get("test", "st_stop")

if "run_count" not in st.session_state:
    st.session_state.run_count = 0
if "counter" not in st.session_state:
    st.session_state.counter = 0

st.session_state.run_count += 1


# Test 7: st.stop ends script, doesn't wait for slow fragment
if test_mode == "st_stop":
    start_time = time.time()

    @st.fragment(parallel=True)
    def fragment_a():
        st.write("Fragment A content")
        st.stop()

    @st.fragment(parallel=True)
    def fragment_b():
        time.sleep(5)
        st.write("Fragment B done after 5s")

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
        time.sleep(5)
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
