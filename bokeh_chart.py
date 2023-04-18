import streamlit as st
from bokeh.plotting import figure
from bokeh.models import ColumnDataSource, TableColumn, DataTable

import pandas as pd

x = [1, 2, 3, 4, 5]
y = [6, 7, 2, 4, 5]

p = figure(
    title='simple line example',
    x_axis_label='x',
    y_axis_label='y')

p.line(x, y, legend_label='Trend', line_width=2)

st.bokeh_chart(p, use_container_width=True)


df = pd.DataFrame({
    'SubjectID': ['Subject_01','Subject_02','Subject_03'],
    'Result_1': ['Positive','Negative','Negative'],
    'Result_2': ['Negative','Negative','Negative'],
    'Result_3': ['Negative','Invalid','Positive'],
    'Result_4': ['Positive','Negative','Negative'],
    'Result_5': ['Positive','Positive','Negative']
})
  
source = ColumnDataSource(df)

columns = [
    TableColumn(field='SubjectID', title='SubjectID'),
    TableColumn(field='Result_1', title='Result 1'),
    TableColumn(field='Result_2', title='Result 2'),
    TableColumn(field='Result_3', title='Result 3'),
    TableColumn(field='Result_4', title='Result 4'),
    TableColumn(field='Result_5', title='Result 5')
    ]

myTable = DataTable(source=source, columns=columns)

st.bokeh_chart(myTable, use_container_width=True)
