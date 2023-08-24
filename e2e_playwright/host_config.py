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

from bokeh.plotting import figure

import streamlit as st
from streamlit.components.v1 import declare_component, html, iframe

st.set_page_config(page_icon="⚠️", page_title="Limited App")

st.experimental_set_query_params(my_query_param="is not allowed")

st.markdown("Using `unsafe_allow_html=True` is not allowed.", unsafe_allow_html=True)

iframe("https://www.streamlit.io", height=200)

html("<h1>HTML</h1>")

st.camera_input("Camera input is not supported")

st.download_button("Download button is not supported", data=b"foo", file_name="foo.txt")

st.file_uploader("File uploader is not supported")

p = figure(title="simple line example", x_axis_label="x", y_axis_label="y")
p.line([1, 2, 3, 4, 5], [6, 7, 2, 4, 5], legend_label="Trend", line_width=2)

st.bokeh_chart(p, use_container_width=True)

st.image(
    """
<svg width="100" height="100">
    <circle cx="50" cy="50" r="40" stroke="green" stroke-width="4" fill="yellow" />
</svg>
""",
    width=100,
)

url = "http://not.a.real.url"
test_component = declare_component("test_component", url=url)
test_component()

# Check that some other elements are working fine:

st.markdown("Normal markdown is **allowed**!!")
st.line_chart({"data": [1, 2, 3]})
st.dataframe({"data": [1, 2, 3]})
