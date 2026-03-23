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

import streamlit as st

st.header("st.iframe examples")

# Example 1: HTML string (fallback mode)
st.subheader("HTML string")
st.iframe(
    """
    <html>
    <head><style>body { font-family: sans-serif; padding: 1rem; margin: 0; }</style></head>
    <body>
        <h2>Hello from iframe!</h2>
        <p>This is embedded HTML content.</p>
    </body>
    </html>
    """,
    height=150,
)

# Example 2: HTML string with explicit dimensions
st.subheader("Fixed dimensions")
st.iframe(
    "<div style='background: #e0e0e0; padding: 20px; text-align: center;'>"
    "Fixed width (400px) and height (100px)</div>",
    width=400,
    height=100,
)

# Example 3: Data URL
st.subheader("Data URL")
st.iframe("data:text/html,<h1 style='color: blue;'>Data URL content</h1>", height=80)

# Example 4: Width options
st.subheader("Width options")
col1, col2 = st.columns(2)
with col1:
    st.write("width='stretch'")
    st.iframe(
        "<div style='background: #90EE90; padding: 10px;'>Stretch width</div>",
        width="stretch",
        height=60,
    )
with col2:
    st.write("width='content'")
    st.iframe(
        "<div style='background: #FFB6C1; padding: 10px; display: inline-block;'>"
        "Content width</div>",
        width="content",
        height=60,
    )

# Example 5: Tab index
st.subheader("Tab index")
st.iframe(
    "<div style='padding: 10px; border: 2px solid blue;' tabindex='0'>"
    "Focusable content (tab_index=0)</div>",
    height=60,
    tab_index=0,
)

# Example 6: Auto-sizing height (height="content")
st.subheader("Auto-sizing height")
st.iframe(
    """
    <html>
    <head><style>body { font-family: sans-serif; padding: 1rem; margin: 0; }</style></head>
    <body>
        <h3>Auto-sized iframe</h3>
        <p>This iframe automatically sizes to its content.</p>
        <ul>
            <li>Item 1</li>
            <li>Item 2</li>
            <li>Item 3</li>
        </ul>
    </body>
    </html>
    """,
    height="content",
)

# Example 7: Auto-sizing both width and height
st.subheader("Auto-sizing both dimensions")
st.iframe(
    """
    <html>
    <head><style>body { font-family: sans-serif; padding: 0.5rem; margin: 0; }</style></head>
    <body>
        <div style="width: 200px; background: #e0f0ff; padding: 10px;">
            <strong>Auto width & height</strong>
            <p style="margin: 5px 0 0;">Both dimensions auto-sized.</p>
        </div>
    </body>
    </html>
    """,
    width="content",
    height="content",
)
