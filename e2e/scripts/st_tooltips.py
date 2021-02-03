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

st.text_input("some input text", "default text", help="tooltip")
st.number_input("number input", value=1, help="tooltip")
st.checkbox("some checkbox", help="this is a checkbox")
st.radio("best animal", ("tiger", "giraffe", "bear"), 0, help="select the best animal")
st.button("some button", help="tooltip")
st.selectbox("selectbox", ("a", "b", "c"), 0, help="tooltip")
st.time_input("time", datetime(2019, 7, 6, 21, 15), help="tooltip")
st.date_input("date", datetime(2019, 7, 6, 21, 15), help="tooltip")
st.slider("slider", 0, 100, 50, help="tooltip")
st.color_picker("color picker", help="tooltip")
st.file_uploader("file uploader", help="tooltip")
st.multiselect("multiselect", ["a", "b", "c"], ["1", "2", "3"], help="tooltip")
st.text_area("textarea", help="tooltip")
st.select_slider('selectslider', options=['a', 'b', 'c'], help="tooltip")