import streamlit as st
from bokeh.plotting import figure


st.title('Bokeh Charts')
st.subheader('Line Plot')

# prepare some data
x = [1, 2, 3, 4, 5]
y = [6, 7, 2, 4, 5]

# create a new plot with a title and axis labels
p = figure(title='simple line example', x_axis_label='x', y_axis_label='y')

# add a line renderer with legend and line thickness
p.line(x, y, legend='Trend', line_width=2)

# show the results
st.bokeh_chart(p)
