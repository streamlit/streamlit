# Copyright 2018-2020 Streamlit Inc.
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

st.text_input("some input text", "default text", help=default_tooltip)
st.number_input("number input", value=1, help=default_tooltip)
st.checkbox("some checkbox", help=default_tooltip)
st.radio("best animal", ("tiger", "giraffe", "bear"), 0, help=default_tooltip)
st.button("some button", help=default_tooltip)
st.selectbox("selectbox", ("a", "b", "c"), 0, help=default_tooltip)
st.time_input("time", datetime(2019, 7, 6, 21, 15), help=default_tooltip)
st.date_input("date", datetime(2019, 7, 6, 21, 15), help=default_tooltip)
st.slider("slider", 0, 100, 50, help=default_tooltip)
st.color_picker("color picker", help=default_tooltip)
st.file_uploader("file uploader", help=default_tooltip)
st.multiselect("multiselect", ["a", "b", "c"], ["a", "b"], help=default_tooltip)
st.text_area("textarea", help=default_tooltip)
st.select_slider("selectslider", options=["a", "b", "c"], help=default_tooltip)
