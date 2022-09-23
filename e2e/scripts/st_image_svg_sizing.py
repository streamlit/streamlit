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

SVG_RED_CIRCLE = """
<svg>
    <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red"/>
</svg>
"""

SVG_RED_CIRCLE_WITH_WIDTH_AND_HEIGHT = """
<svg width="100" height="100">
  <circle cx="50" cy="50" r="40" stroke="black" stroke-width="3" fill="red" />
  Sorry, your browser does not support inline SVG.
</svg>
"""

SVG_YELLOW_GREEN_RECTANGLES_WITH_VIEW_BOX_UNFORMATTED = """
<svg viewBox="{x} 0 100 90" xmlns="http://www.w3.org/2000/svg">
    <rect x="0" y="0" width="100" height="90" fill="yellow" />
    <rect x="100" y="0" width="100" height="90" fill="green" />
</svg>
"""

st.write("svg red circle without width and height renders as svg")
st.image(SVG_RED_CIRCLE)

st.write("svg red circle with width and height renders as img and scales")
st.image(SVG_RED_CIRCLE_WITH_WIDTH_AND_HEIGHT, width=150)
st.image(SVG_RED_CIRCLE_WITH_WIDTH_AND_HEIGHT, width=200)
st.image(SVG_RED_CIRCLE_WITH_WIDTH_AND_HEIGHT, use_column_width=True)


st.write("svg rectangles yellow and green renders as img scales and viewbox is working")
st.image(SVG_YELLOW_GREEN_RECTANGLES_WITH_VIEW_BOX_UNFORMATTED.format(x=50))
st.image(SVG_YELLOW_GREEN_RECTANGLES_WITH_VIEW_BOX_UNFORMATTED.format(x=0), width=300)
st.image(SVG_YELLOW_GREEN_RECTANGLES_WITH_VIEW_BOX_UNFORMATTED.format(x=100), width=300)
st.image(
    SVG_YELLOW_GREEN_RECTANGLES_WITH_VIEW_BOX_UNFORMATTED.format(x=50),
    use_column_width=True,
)
