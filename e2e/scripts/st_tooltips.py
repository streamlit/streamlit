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
from datetime import datetime

default_tooltip = """
This is a really long tooltip.

Lorem ipsum dolor sit amet, consectetur adipiscing elit. Ut ut turpis vitae
justo ornare venenatis a vitae leo. Donec mollis ornare ante, eu ultricies
tellus ornare eu. Donec eros risus, ultrices ut eleifend vel, auctor eu turpis.
In consectetur erat vel ante accumsan, a egestas urna aliquet. Nullam eget
sapien eget diam euismod eleifend. Nulla purus enim, finibus ut velit eu,
malesuada dictum nulla. In non arcu et risus maximus fermentum eget nec ante.
""".strip()

leading_indent_code_tooltip = """
Code:

    This
    is
    a
    code
    block!"""

leading_indent_regular_text_tooltip = """
This is a regular text block!
Test1
Test2

"""

indented_code_tooltip = """
Code:

    for i in range(10):
        x = i * 10
        print(x)
    """

no_indent_tooltip = "thisisatooltipwithnoindents. It has some spaces but no idents."

st.text_input("some input text", "default text", help=default_tooltip)
st.number_input("number input", value=1, help=leading_indent_code_tooltip)
st.checkbox("some checkbox", help=leading_indent_regular_text_tooltip)
st.radio("best animal", ("tiger", "giraffe", "bear"), 0, help=indented_code_tooltip)
st.selectbox("selectbox", ("a", "b", "c"), 0, help=default_tooltip)
st.time_input("time", datetime(2019, 7, 6, 21, 15), help=leading_indent_code_tooltip)
st.date_input(
    "date", datetime(2019, 7, 6, 21, 15), help=leading_indent_regular_text_tooltip
)
st.slider("slider", 0, 100, 50, help=indented_code_tooltip)
st.color_picker("color picker", help=no_indent_tooltip)
st.file_uploader("file uploader", help=default_tooltip)
st.multiselect(
    "multiselect", ["a", "b", "c"], ["a", "b"], help=leading_indent_code_tooltip
)
st.text_area("textarea", help=leading_indent_regular_text_tooltip)
st.select_slider("selectslider", options=["a", "b", "c"], help=indented_code_tooltip)
st.button("some button", help=no_indent_tooltip)
st.metric("some metric", value=500, help=no_indent_tooltip)
