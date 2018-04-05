"""Example of everything that's possible in streamlit."""

import pandas as pd
import numpy as np
from PIL import Image
import urllib, io
import sys
from datetime import datetime

from streamlit import Report, Chart

with Report() as write:
    # Title.
    write('Periodic Table of the Elements', fmt='header', level=1)
    write('This report shows some of the awesome elements of Streamlit.')

    # Arrays
    write('Numpy Arrays', fmt='header', level=2)
    write(np.random.randn(100, 100))

    # Charts.
    write('Charts', fmt='header', level=2)
    chart_data = pd.DataFrame(
        np.random.randn(20, 5),
        columns=['pv', 'uv', 'a', 'b', 'c']
    )

    write('Line Chart', fmt='header', level=3)
    write.line_chart(chart_data)

    write('Area Chart', fmt='header', level=3)
    write.area_chart(chart_data)

    write('Bar Chart', fmt='header', level=3)
    write.bar_chart(chart_data[['pv', 'uv']].iloc[:10])

    # Customized charts.
    write('Customized charts', fmt='header', level=2)

    write('Customized Line Chart', fmt='header', level=3)
    write(Chart(chart_data, 'line_chart')
        .line(type='monotone', data_key='pv', stroke='#8884d8')
        .line(type='monotone', data_key='uv', stroke='#82ca9d'))

    write('Composed Chart', fmt='header', level=3)
    write(Chart(chart_data, 'composed_chart')
        .x_axis()
        .y_axis()
        .cartesian_grid(stroke_dasharray='3 3')
        .tooltip()
        .legend()
        .bar(data_key='pv', fill='#82ca9d')
        .area(type='monotone', data_key='uv', fill='#8884d8', stroke='#8884d8'))

    write('Datetime Indices', fmt='header', level=4)
    date_range = pd.date_range('1/2/2011', periods=60, freq='D')
    ts = pd.Series(np.random.randn(len(date_range)), index=date_range)
    write.line_chart(ts)

    # DataFrames
    write('Pandas DataFrames', fmt='header', level=2)
    arrays = [
        np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
        np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]
    df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
        columns=[datetime(2012, 5, 1), datetime(2012, 5, 2), datetime(2012, 5, 3), datetime(2012, 5, 4)])
    write('Here is a dataframe.', df, 'And here is its transpose.', df.T)

    # Alerts
    write('Alerts', fmt='header', level=2)
    write.alert('This is a "success" alert.', type='success')
    write.alert('This is an "info" alert.', type='info')
    write.alert('This is a "warning" alert.', type='warning')
    write.alert('This is a "danger" alert.', type='danger')

    # Headers
    write('Headers', fmt='header', level=2)
    write.header('Level 1', level=1)
    write.header('Level 2', level=2)
    write.header('Level 3', level=3)
    write.header('Level 4', level=4)
    write.header('Level 5', level=5)
    write.header('Level 6', level=6)

    # Images - We test all 6 possible file formats.
    write('Images', fmt='header', level=2)
    img_url = 'https://www.psdbox.com/wp-content/uploads/2014/08/HDR-landscape-tutorial-A.jpg'
    img_bytes = urllib.request.urlopen(img_url).read()
    img = np.array(Image.open(io.BytesIO(img_bytes)))
    grayscale = np.average(img, axis=2).astype(np.uint8)
    grayscale2 = grayscale.reshape(grayscale.shape + (1,))
    channels = img.transpose((2, 0, 1))
    channels2 = channels.reshape(channels.shape + (1,))
    channels_caption = ['Red', 'Green', 'Blue']
    write(img, fmt='img', caption="375px", width=375)         #    (w, h, 3)
    write([img], fmt='img', caption="225px", width=225)       # (n, w, h, 3)
    write(grayscale, fmt='img', caption="175px", width=175)   #    (w, h)
    write(grayscale2, fmt='img', caption="125px", width=125)  #    (w, h, 1)
    write.img(channels, caption=channels_caption, width=125)  # (n, w, h)
    write.img(channels2, caption=channels_caption, width=75)  # (n, w, h, 1)

    # Text
    write('Text', fmt='header', level=2)

    write.header('Character Wrapping', level=5)
    write(
        'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
        'eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ' +
        'ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut ' +
        'aliquip ex ea commodo consequat. Duis aute irure dolor in ' +
        'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla ' +
        'pariatur. Excepteur sint occaecat cupidatat non proident, sunt in ' +
        'culpa qui officia deserunt mollit anim id est laborum.');

    write.header('Space preservation', level=5)
    write(
        '...    0 leading spaces\n' +
        ' ...   1 leading space\n' +
        '  ...  2 leading spaces\n' +
        '   ... 3 leading spaces');

    write('Markdown', fmt='header', level=2)
    write.markdown("""
        Markdown allows for adding markup to plain text with intuitive
        and minimal syntax. For example:

        - to *emphasize* a word simply surround it with `*`
        - headings are prefixed with `#`, where the count indicates the level
        - lists like these have each item prefixed with `-`

        ```python
          # it's even possible to display code
          for i in range(0, 10):
            print(i)
        ```
    """)

    write('JSON', fmt='header', level=2)
    write('You can pass a JSON string.')
    write.json('{"object":{"array":[1,true,"3"]}}')
    write('Or an object directly:')
    write.json({'hello': 'world'})

    # Progress
    write('Progress Bars', fmt='header', level=2)
    for percent in [100, 75, 50, 25, 0]:
        write(f'{percent}% progress:')
        write.progress(percent)
