import streamlit as st
from bokeh.plotting import figure

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
