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

"""Test app for pyplot/image width regression in v1.50.0.

Reproduces issues:
- #12678: Plots shown tiny in fragments
- #12763: Images shown tiny with expanders

This app tests width calculation for pyplot elements with different width modes
(default/stretch and content) across different contexts (fragments, expanders, containers).
"""

import matplotlib.pyplot as plt

import streamlit as st

st.title("Width Regression Tests")

# Define test scenarios: (width_mode, context, test_index)
test_scenarios = [
    ("default", "fragment", 0),
    ("content", "fragment", 1),
    ("default", "expander", 2),
    ("content", "expander", 3),
    ("default", "container", 4),
    ("content", "container", 5),
]


def render_test_case(width_mode: str, context: str, idx: int):
    """Render a single test case for the given width mode and context."""
    st.header(f"Test {idx + 1}: width='{width_mode}' in {context}")

    # Create a figure for this test
    fig, ax = plt.subplots(figsize=(10, 3))
    ax.bar([1, 2, 3], [1, 2, 3])
    ax.set_title(f"width={width_mode} in {context}")

    # Render in appropriate context
    if context == "fragment":

        @st.fragment
        def render_in_fragment():
            if width_mode == "content":
                st.pyplot(fig, width="content")
            else:
                # Default: no width parameter (uses stretch behavior)
                st.pyplot(fig)

        render_in_fragment()

    elif context == "expander":
        with st.expander(f"{width_mode} width in expander", expanded=True):
            if width_mode == "content":
                st.pyplot(fig, width="content")
            else:
                st.pyplot(fig)

    elif context == "container":
        with st.container(border=True):
            if width_mode == "content":
                st.pyplot(fig, width="content")
            else:
                st.pyplot(fig)


for width_mode, context, idx in test_scenarios:
    render_test_case(width_mode, context, idx)
