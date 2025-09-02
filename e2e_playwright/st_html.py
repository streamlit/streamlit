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
from pathlib import Path

import streamlit as st

# Construct test assets path relative to this script file to
# allow its execution with different working directories.
TEST_ASSETS_DIR = Path(__file__).parent / "test_assets"
# Test that we can render HTML with in-line styles
st.html(
    """
    <div style="font-family: 'Comic Sans MS'; color: orange">
        This is a div with some inline styles.
    </div>
    """
)
# Test that script tags are sanitized
st.html(
    """
    <i> This is a i tag </i>
    <script>
        alert('BEWARE - the script tag is scripting');
    </script>
    <strong> This is a strong tag </strong>
    """
)
# Test that style tags are applied
st.html(
    """
    <style>
        #corgi {
            color:blue;
        }
    </style>
    <div id="corgi">This text should be blue</div>
    """
)
# Test that non-rendered HTML doesn't cause extra spacing
with st.expander("HTML Elements for Spacing Test", expanded=True):
    st.write("Before tag:")
    st.html(
        """
        <style>
            #style-test {
                color: purple;
            }
        </style>
        """
    )
    st.write("After tag")
st.write("## Style test")
# Test that we can load HTML files from str paths
HTML_PATH = TEST_ASSETS_DIR / "test_div.html"
st.html(str(HTML_PATH))
# Test that we can load HTML files from Path objects
st.html(HTML_PATH)
# Test that we can load CSS files and they are wrapped in style tags
CSS_PATH = TEST_ASSETS_DIR / "test.css"
st.html(CSS_PATH)
st.write("# Hello, World!")
st.write("## Random")
st.write("### Corgis")


st.html(
    """
    <div style="background-color: lightblue; padding: 10px; border: 1px solid blue;">
        This HTML element uses content width
    </div>
    """,
    width="content",
)


st.html(
    """
    <div style="background-color: lightgreen; padding: 10px; border: 1px solid green;">
        This HTML element uses stretch width
    </div>
    """,
    width="stretch",
)

st.html(
    """
    <div style="background-color: lightyellow; padding: 10px; border: 1px solid orange;">
        This HTML element has a fixed width of 300px
    </div>
    """,
    width=300,
)
