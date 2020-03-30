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

"""
# File Uploader

It's hard to test the ability to upload files in an automated way, so here you
should test it by hand. Please upload a CSV file and make sure a table shows up
below with its contents.
"""

w = st.file_uploader("Upload a CSV file", type="csv")
if w:
    import pandas as pd

    data = pd.read_csv(w)
    st.write(data)
