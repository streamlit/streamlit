"""Test scripts to see if the server is working."""

from tiny_notebook import Notebook, Chart
import pandas as pd
import numpy as np

import time # debug

with Notebook() as write:
    write.header('Created a Notebook.', level=3)
    write.text('Hello, world!')

    # arrays = [
    #     np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
    #     np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]
    # df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
    #     columns=['A', 'B', 'C', 'D'])
    # # write.dataFrame(df)
    # # write.text('Here is the transpose table:')
    # # write.dataFrame(df.T)
    # write.header('A big numpy array:', level=6)
    # write.dataFrame(np.random.randn(100, 100))

    # create data for the chart
    write.header('About to write a chart:', level=5)
    data = pd.DataFrame(np.random.randn(20, 2), columns=['pv', 'uv'])
    write.dataFrame(data)

    # write the chart
    line_chart = Chart(data, 'line_chart',
        width=600, height=300)
    line_chart.x_axis(data_key="name")
    line_chart.y_axis()
    line_chart.cartesian_grid(stroke_dasharray='3 3')
    line_chart.tooltip()
    line_chart.legend()
    line_chart.line(type='monotone', data_key='pv', stroke='#8884d8',
        strokeDasharray='5 5')
    line_chart.line(type='monotone', data_key='uv', stroke='#82ca9d',
        strokeDasharray='3 4 5 2')
    write.chart(line_chart)

    # write.alert('Sleeping for 5 seconds.')
    # import time
    # time.sleep(5)
    # print("We're about to send out a bit more text.")
    # write.text("Here is a bit more text. Let's see how this renders!")
    # write.alert('Success', type='success')
    # write.alert('Info', type='info')
    # write.alert('Warning', type='warning')
    # write.header('Header 1', level=1)
    # write.header('Header 2', level=2)
    # write.header('Header 3', level=3)
    # write.header('Header 4', level=4)
    # write.header('Header 5', level=5)
    # write.header('Header 6', level=6)

print('Sleeping for another second...')
time.sleep(1)
