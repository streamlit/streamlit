# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

st.image(
    """
<svg>
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
  Sorry, your browser does not support inline SVG.
</svg>
"""
)

SVG_RED_CIRCLE = """
<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
  Sorry, your browser does not support inline SVG.
</svg>
"""

st.image(SVG_RED_CIRCLE)
st.image(SVG_RED_CIRCLE, width=300)


SVG_YELLOW_GREEN_RECTANGLE = """
<svg viewBox="{x} 0 100 90" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="100" height="90" fill="yellow" />
    <rect x="100" y="0" width="100" height="90" fill="green" />
</svg>
"""

st.image(SVG_YELLOW_GREEN_RECTANGLE.format(x=50), width=100)
st.image(SVG_YELLOW_GREEN_RECTANGLE.format(x=50), width=300)

st.image(SVG_YELLOW_GREEN_RECTANGLE.format(x=0), width=100)
st.image(SVG_YELLOW_GREEN_RECTANGLE.format(x=0), width=300)

st.image(SVG_YELLOW_GREEN_RECTANGLE.format(x=100), width=100)
st.image(SVG_YELLOW_GREEN_RECTANGLE.format(x=100), width=300)
