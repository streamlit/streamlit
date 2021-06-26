# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

import streamlit as st

# st.session_state can only be accessed while running with streamlit
if st._is_running_with_streamlit:
    if "initialized" not in st.session_state:
        st.session_state["item_counter"] = 0
        st.session_state.attr_counter = 0

        st.session_state.initialized = True

    if st.button("inc_item_counter"):
        st.session_state["item_counter"] += 1

    if st.button("inc_attr_counter"):
        st.session_state.attr_counter += 1

    if st.button("del_item_counter"):
        del st.session_state["item_counter"]

    if st.button("del_attr_counter"):
        del st.session_state.attr_counter

    if "item_counter" in st.session_state:
        st.write(f"item_counter: {st.session_state['item_counter']}")

    if "attr_counter" in st.session_state:
        st.write(f"attr_counter: {st.session_state.attr_counter}")

    st.write(f"len(st.session_state): {len(st.session_state)}")
    st.write(st.session_state)
