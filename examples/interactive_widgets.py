# -*- coding: utf-8 -*-
# Copyright 2018-2019 Streamlit Inc.
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
from datetime import time
from datetime import date

st.title("Interactive Widgets")

st.subheader("Checkbox")
w1 = st.checkbox("I am human", True)
st.write(w1)

if w1:
    st.write("Agreed")

st.subheader("Slider")
w2 = st.slider("Age", 0.0, 100.0, (32.5, 72.5), 0.5)
st.write(w2)

st.subheader("Textarea")
w3 = st.text_area("Comments", "Streamlit is awesomeness!")
st.write(w3)

st.subheader("Button")
w4 = st.button("Click me")
st.write(w4)

if w4:
    st.write("Hello, Interactive Streamlit!")

st.subheader("Radio")
options = ("female", "male")
w5 = st.radio("Gender", options, 1)
st.write(w5)

st.subheader("Text input")
w6 = st.text_input("Text input widget", "i iz input")
st.write(w6)

st.subheader("Selectbox")
options = ("first", "second")
w7 = st.selectbox("Options", options, 1)
st.write(w7)

st.subheader("Time Input")
w8 = st.time_input("Set an alarm for", time(8, 45))
st.write(w8)

st.subheader("Date Input")
w9 = st.date_input("A date to celebrate", date(2019, 7, 6))
st.write(w9)

st.subheader("File Uploader")
w10 = st.file_uploader("Upload a CSV file", type="csv")
if w10:
    data = pd.read_csv(w10)
    st.write(data)
