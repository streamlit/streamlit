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

x = [1, 2, 3, 4, 5]
y = [6, 7, 2, 4, 5]

p = figure(title="simple line example", x_axis_label="x", y_axis_label="y")
p.line(x, y, legend="Trend", line_width=2)
st.bokeh_chart(p)

# draw charts in columns

left_chart = figure(title="Left", x_axis_label="x", y_axis_label="y")
left_chart.line(x, y, legend="Trend", line_width=2)

right_chart = figure(title="Right", x_axis_label="x", y_axis_label="y")
right_chart.line(x, y, legend="Trend", line_width=2)

col1, col2 = st.columns([1, 1])

with col1:
    st.bokeh_chart(left_chart, use_container_width=True)

with col2:
    st.bokeh_chart(right_chart, use_container_width=True)
