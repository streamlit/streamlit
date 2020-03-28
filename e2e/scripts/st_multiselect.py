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

options = ("male", "female")
i1 = st.multiselect("selectbox 1", options)
st.text("value 1: %s" % i1)

i2 = st.multiselect("selectbox 2", options, format_func=lambda x: x.capitalize())
st.text("value 2: %s" % i2)

i3 = st.multiselect("selectbox 3", [])
st.text("value 3: %s" % i3)

i4 = st.multiselect("selectbox 4", ["coffee", "tea", "water"], ["tea", "water"])
st.text("value 4: %s" % i4)
