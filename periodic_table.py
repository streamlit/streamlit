"""Test scripts to see if the server is working."""

from tiny_notebook import Notebook, Chart
import pandas as pd
import numpy as np
from PIL import Image
import urllib, io


import time # debug

with Notebook() as write:
    # Title.
    write.header('Period Table of the Elements', level=1)
    write.text('This notebook shows some of the awesome elements of printf.')

    # Arrays
    write.header('Numpy Arrays', level=3)

    write.data_frame(np.random.randn(100, 100))

    # Charts.
    write.header('Charts', level=3)

    chart_data = \
        pd.DataFrame(np.random.randn(20, 2), columns=['pv', 'uv'])

    write.header('Line Chart', level=4)

    line_chart = Chart(chart_data, 'line_chart')
    line_chart.x_axis()
    line_chart.y_axis()
    line_chart.cartesian_grid(stroke_dasharray='3 3')
    line_chart.tooltip()
    line_chart.legend()
    line_chart.line(type='monotone', data_key='pv', stroke='#8884d8')
    line_chart.line(type='monotone', data_key='uv', stroke='#82ca9d')
    write.chart(line_chart)

    write.header('Area Chart', level=4)

    area_chart = Chart(chart_data, 'area_chart')
    area_chart.x_axis()
    area_chart.y_axis()
    area_chart.cartesian_grid(stroke_dasharray='3 3')
    area_chart.tooltip()
    area_chart.legend()
    area_chart.area(type='monotone', data_key='pv',
        stroke='#82ca9d', fill='#82ca9d')
    area_chart.area(type='monotone', data_key='uv',
        stroke='#8884d8', fill='#8884d8')
    write.chart(area_chart)

    write.header('Bar Chart', level=4)

    bar_chart = Chart(chart_data[:10], 'bar_chart')
    bar_chart.x_axis()
    bar_chart.y_axis()
    bar_chart.cartesian_grid(stroke_dasharray='3 3')
    bar_chart.tooltip()
    bar_chart.legend()
    bar_chart.bar(data_key='pv', fill='#82ca9d')
    bar_chart.bar(data_key='uv', fill='#8884d8')
    write.chart(bar_chart)

    write.header('Composed Chart', level=4)

    composed_chart = Chart(chart_data, 'composed_chart')
    composed_chart.x_axis()
    composed_chart.y_axis()
    composed_chart.cartesian_grid(stroke_dasharray='3 3')
    composed_chart.tooltip()
    composed_chart.legend()
    composed_chart.bar(data_key='pv', fill='#82ca9d')
    composed_chart.area(type='monotone', data_key='uv', fill='#8884d8')
    write.chart(composed_chart)

    # DataFrames
    write.header('Pandas DataFrames', level=3)

    arrays = [
        np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
        np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]
    df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
        columns=['A', 'B', 'C', 'D'])

    write.text('Here is a dataframe.')
    write.data_frame(df)
    write.text('And here is its transpose.')
    write.data_frame(df.T)

    # Alerts
    write.header('Alerts', level=3)

    write.alert('This is a "success" alert.', type='success')
    write.alert('This is an "info" alert.', type='info')
    write.alert('This is a "warning" alert.', type='warning')
    write.alert('This is a "danger" alert.', type='danger')

    # Headers
    write.header('Headers', level=3)

    write.header('Level 1', level=1)
    write.header('Level 2', level=2)
    write.header('Level 3', level=3)
    write.header('Level 4', level=4)
    write.header('Level 5', level=5)
    write.header('Level 6', level=6)

    # Images
    write.header('Images', level=3)

    img_url = 'https://upload.wikimedia.org/wikipedia/en/2/24/Lenna.png'
    img_bytes = urllib.request.urlopen(img_url).read()
    img = np.array(Image.open(io.BytesIO(img_bytes)))
    write.img(img, caption="225px", width=225)
    write.img(img, caption="175px", width=175)
    write.img(img, caption="125px", width=125)
    channels = [np.array(img), np.array(img), np.array(img)]
    channels[0][:,:,1:] = 0
    channels[1][:,:,0::2] = 0
    channels[2][:,:,:-1] = 0
    write.img(channels, caption=["Red", "Green", "Blue"], width=125)

    # Text
    write.header('Text', level=3)

    write.header('Character Wrapping', level=5)
    write.text(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
        'eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ' +
        'ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut ' +
        'aliquip ex ea commodo consequat. Duis aute irure dolor in ' +
        'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla ' +
        'pariatur. Excepteur sint occaecat cupidatat non proident, sunt in ' +
        'culpa qui officia deserunt mollit anim id est laborum.');

    write.header('Space preservation', level=5)
    write.text(
        '...    0 leading spaces\n' +
        ' ...   1 leading space\n' +
        '  ...  2 leading spaces\n' +
        '   ... 3 leading spaces');


print('Sleeping for another second...')
time.sleep(1)
