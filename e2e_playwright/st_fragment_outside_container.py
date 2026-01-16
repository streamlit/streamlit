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

"""Test app for fragments writing widgets to outside containers.

This tests the feature that allows fragments to write widgets to containers
that were created outside the fragment's scope.
"""

from uuid import uuid4

import streamlit as st

# Test 1: Basic widget in outside container
# The container is created BEFORE the fragment, and the fragment writes to it
outside_container = st.container()


@st.fragment
def fragment_with_outside_widget():
    """Fragment that writes a button to an outside container."""
    outside_container.button("Outside Button", key="outside_btn")
    st.write(f"Basic fragment UUID: {uuid4()}")


fragment_with_outside_widget()
st.write(f"App UUID: {uuid4()}")

st.divider()

# Test 2: Counter in outside container to verify state works correctly
if "counter" not in st.session_state:
    st.session_state.counter = 0

counter_container = st.container()


@st.fragment
def counter_fragment():
    """Fragment that manages a counter in an outside container."""
    if counter_container.button("Increment Counter", key="increment_btn"):
        st.session_state.counter += 1
    counter_container.write(f"Counter value: {st.session_state.counter}")


counter_fragment()

st.divider()

# Test 3: Multiple elements written to outside container
multi_container = st.container()


@st.fragment
def multi_element_fragment():
    """Fragment that writes multiple elements to an outside container."""
    multi_container.text_input("Name", key="name_input")
    multi_container.selectbox("Color", ["Red", "Green", "Blue"], key="color_select")
    multi_container.write(f"Multi-element fragment UUID: {uuid4()}")


multi_element_fragment()

st.divider()

# Test 4: Nested container scenario
outer_container = st.container()
with outer_container:
    inner_container = st.container()


@st.fragment
def nested_container_fragment():
    """Fragment that writes to a nested container created outside."""
    inner_container.button("Nested Button", key="nested_btn")
    inner_container.write(f"Nested fragment UUID: {uuid4()}")


nested_container_fragment()

# Full rerun button at the bottom
st.button("Full Rerun", key="full_rerun_btn")
