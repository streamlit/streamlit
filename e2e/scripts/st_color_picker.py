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

c1 = st.color_picker("Default Color")
st.write("Color 1", c1)

c2 = st.color_picker("New Color", "#EB144C")
st.write("Color 2", c2)

c3 = st.color_picker("Disabled", disabled=True)
st.write("Color 3", c3)

c4 = st.color_picker("Hidden Label", label_visibility="hidden")
st.write("Color 4", c4)

c5 = st.color_picker("Collapsed Label", label_visibility="collapsed")
st.write("Color 5", c5)
