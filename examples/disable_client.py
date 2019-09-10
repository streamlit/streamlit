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

# DISABLED
st.set_option("client.displayEnabled", False)

st.text("This should not appear")

# ENABLED
st.set_option("client.displayEnabled", True)

a = st.text("This will be overwritten")
b = st.text("This will be overwritten too")
a.text("This should show up first")

# DISABLED
st.set_option("client.displayEnabled", False)

b.text("This overwrites b, but should not appear")
st.write("This should not appear")
st.line_chart([1, 2, 3, 4])

with st.echo():
    foo = "Nothing matters in here!"
    st.write("Nothing here will appear")

# ENABLED
st.set_option("client.displayEnabled", True)

st.write("This should appear last")
b.text("This should appear second")
