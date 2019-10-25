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

"""Example of file uploader."""

import streamlit as st
import csv

st.title("Streamlit file_uploader widget")

file_csv = st.file_uploader("Upload a CSV file", type=([".csv"]))

if file_csv:
    
    file_csv_bytes = st.file_reader(file_csv)
    data_csv = file_csv_bytes.decode('utf-8').splitlines()
    reader = csv.reader(data_csv, quoting=csv.QUOTE_MINIMAL)
    
    results = []
    for row in reader: # each row is a list
        results.append(row)

    st.dataframe(results)


file_png = st.file_uploader("Upload a PNG image", type=([".png"]))

if file_png:
    file_png_bytes = st.file_reader(file_png)
    st.image(file_png_bytes)


file_mkv = st.file_uploader("Upload a MKV image", type=([".mkv"]))

if file_mkv:
    file_mkv_bytes = st.file_reader(file_mkv)
    st.write(len(file_mkv_bytes))