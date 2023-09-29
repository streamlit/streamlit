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

import numpy as np
from bokeh.layouts import column, row
from bokeh.models import ColumnDataSource, CustomJS, Slider
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

x = np.linspace(0, 10, 500)
y = np.sin(x)

source = ColumnDataSource(data=dict(x=x, y=y))

plot = figure(y_range=(-10, 10), width=400, height=400)

plot.line("x", "y", source=source, line_width=3, line_alpha=0.6)

amp = Slider(start=0.1, end=10, value=1, step=0.1, title="Amplitude")
freq = Slider(start=0.1, end=10, value=1, step=0.1, title="Frequency")
phase = Slider(start=-6.4, end=6.4, value=0, step=0.1, title="Phase")
offset = Slider(start=-9, end=9, value=0, step=0.1, title="Offset")

callback = CustomJS(
    args=dict(source=source, amp=amp, freq=freq, phase=phase, offset=offset),
    code="""
    const A = amp.value
    const k = freq.value
    const phi = phase.value
    const B = offset.value

    const x = source.data.x
    const y = Array.from(x, (x) => B + A*Math.sin(k*x+phi))
    source.data = { x, y }
""",
)

amp.js_on_change("value", callback)
freq.js_on_change("value", callback)
phase.js_on_change("value", callback)
offset.js_on_change("value", callback)

st.bokeh_chart(row(plot, column(amp, freq, phase, offset)))
