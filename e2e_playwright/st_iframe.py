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

from pathlib import Path
import tempfile

import streamlit as st

# --- URL-based iframes ---
st.markdown("### URL iframes")

# External URL with fixed height
st.iframe("https://example.com", height=200)

# Data URL
st.iframe("data:text/html,<h1>Data URL Content</h1>", height=100)

# --- HTML string iframes ---
st.markdown("### HTML string iframes")

# Simple HTML with auto-height (content mode)
st.iframe("<p style='margin:0;padding:10px;'>Auto height HTML</p>")

# HTML with fixed height
st.iframe(
    "<div style='background:lightblue;padding:20px;margin:0;'>Fixed height content</div>",
    height=150,
)

# HTML with stretch width
st.iframe(
    "<div style='background:lightyellow;padding:10px;margin:0;'>Stretch width</div>",
    width="stretch",
    height=80,
)

# HTML with pixel width
st.iframe(
    "<div style='background:lightgreen;padding:10px;margin:0;'>Pixel width</div>",
    width=300,
    height=80,
)

# --- Local file iframes ---
st.markdown("### Local file iframes")

# Create a temporary HTML file
html_content = """<!DOCTYPE html>
<html>
<body style="margin:0;padding:10px;">
<h2 style="margin:0;">Local HTML File</h2>
<p style="margin:5px 0 0 0;">Loaded from a local file path.</p>
</body>
</html>"""

tmp_dir = tempfile.mkdtemp()
html_path = Path(tmp_dir) / "test_page.html"
html_path.write_text(html_content, encoding="utf-8")

st.iframe(html_path)

# --- Layout options ---
st.markdown("### Layout options")

# Stretch height in a container with defined height
with st.container(height=200, key="stretch-container"):
    st.iframe(
        "<div style='background:lavender;height:100%;margin:0;padding:10px;box-sizing:border-box;'>Stretch height</div>",
        height="stretch",
    )

# --- Tab index ---
st.markdown("### Tab index")

# With tab_index=0
st.iframe(
    "<p style='margin:0;padding:5px;'>Tab index 0</p>",
    height=40,
    tab_index=0,
)

# With tab_index=-1
st.iframe(
    "<p style='margin:0;padding:5px;'>Tab index -1</p>",
    height=40,
    tab_index=-1,
)

# --- Scrolling ---
st.markdown("### Scrolling behavior")

st.iframe(
    "<div style='height:300px;background:linear-gradient(white,blue);margin:0;padding:10px;'>Tall content that needs scrolling</div>",
    height=100,
)
