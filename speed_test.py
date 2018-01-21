"""Test scripts to see if the server is working."""

from tiny_notebook import Notebook, Chart
import pandas as pd
import numpy as np
import time
# from PIL import Image
# import urllib, io

with Notebook() as write:
    # Title.
    write('Speed Test', fmt='header', level=1)
    write("Now we're going to stream some random data to the client.")
    start_time = time.time()

    import string
    alphabet_table = pd.DataFrame(columns=['letters'])
    table = write.dataframe(alphabet_table)
    for i in range(26):
        some_letters = string.ascii_lowercase[:i]
        new_row = pd.DataFrame([some_letters], columns=['letters'], index=[i])
        table.add_rows(new_row)

    # # First create a chart.
    # chart_data = pd.DataFrame(columns=['pv', 'uv'])
    # def line_chart(chart_data):
    #     line_chart = Chart(chart_data, 'line_chart')
    #     line_chart.x_axis()
    #     line_chart.y_axis()
    #     line_chart.cartesian_grid(stroke_dasharray='3 3')
    #     line_chart.tooltip()
    #     line_chart.legend()
    #     line_chart.line(type='monotone', data_key='pv', stroke='#8884d8', dot="false")
    #     line_chart.line(type='monotone', data_key='uv', stroke='#82ca9d', dot="false")
    #     return line_chart
    # table = write.dataframe(chart_data)
    # # chart = write.chart(line_chart(chart_data))
    #
    # animation_seconds, iters, add_per_iter = 5, 100, 25
    # for i in range(iters):
    #     new_data = pd.DataFrame(np.random.randn(add_per_iter, 2),
    #         columns=['pv', 'uv'])
    #     # chart.add_rows(new_data)
    #     chart_data = pd.concat([chart_data, new_data])
    #     # chart.chart(line_chart(chart_data))
    #     table(chart_data)
    #     time.sleep(animation_seconds / iters)

    # # Write out the summary
    # write('Summary', fmt='header', level=5)
    # elapsed = time.time() - start_time
    # write('Added', (iters * add_per_iter), 'elements in', elapsed, 'seconds.')

    # # Arrays
    # write('Numpy Arrays', fmt='header', level=3)
    # write(np.random.randn(100, 100))
    #
    # # Charts.
    # write('Charts', fmt='header', level=3)
    #
    #
    #

    #
    # write('Area Chart', fmt='header', level=4)
    # area_chart = Chart(chart_data, 'area_chart')
    # area_chart.x_axis()
    # area_chart.y_axis()
    # area_chart.cartesian_grid(stroke_dasharray='3 3')
    # area_chart.tooltip()
    # area_chart.legend()
    # area_chart.area(type='monotone', data_key='pv',
    #     stroke='#82ca9d', fill='#82ca9d')
    # area_chart.area(type='monotone', data_key='uv',
    #     stroke='#8884d8', fill='#8884d8')
    # write(area_chart)
    #
    # write('Bar Chart', fmt='header', level=4)
    # bar_chart = Chart(chart_data[:10], 'bar_chart')
    # bar_chart.x_axis()
    # bar_chart.y_axis()
    # bar_chart.cartesian_grid(stroke_dasharray='3 3')
    # bar_chart.tooltip()
    # bar_chart.legend()
    # bar_chart.bar(data_key='pv', fill='#82ca9d')
    # bar_chart.bar(data_key='uv', fill='#8884d8')
    # write(bar_chart)
    #
    # write('Composed Chart', fmt='header', level=4)
    # composed_chart = Chart(chart_data, 'composed_chart')
    # composed_chart.x_axis()
    # composed_chart.y_axis()
    # composed_chart.cartesian_grid(stroke_dasharray='3 3')
    # composed_chart.tooltip()
    # composed_chart.legend()
    # composed_chart.bar(data_key='pv', fill='#82ca9d')
    # composed_chart.area(type='monotone', data_key='uv', fill='#8884d8')
    # write(composed_chart)
    #
    # # DataFrames
    # write('Pandas DataFrames', fmt='header', level=3)
    # arrays = [
    #     np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
    #     np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]
    # df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
    #     columns=['A', 'B', 'C', 'D'])
    # write('Here is a dataframe.', df, 'And here is its transpose.', df.T)
    #
    # # Alerts
    # write('Alerts', fmt='header', level=3)
    # write.alert('This is a "success" alert.', type='success')
    # write.alert('This is an "info" alert.', type='info')
    # write.alert('This is a "warning" alert.', type='warning')
    # write.alert('This is a "danger" alert.', type='danger')
    #
    # # Headers
    # write('Headers', fmt='header', level=3)
    # write.header('Level 1', level=1)
    # write.header('Level 2', level=2)
    # write.header('Level 3', level=3)
    # write.header('Level 4', level=4)
    # write.header('Level 5', level=5)
    # write.header('Level 6', level=6)
    #
    # # Images
    # write('Images', fmt='header', level=3)
    # img_url = 'https://upload.wikimedia.org/wikipedia/en/2/24/Lenna.png'
    # img_bytes = urllib.request.urlopen(img_url).read()
    # img = np.array(Image.open(io.BytesIO(img_bytes)))
    # write(img, fmt='img', caption="225px", width=225)
    # write(img, fmt='img', caption="175px", width=175)
    # write(img, fmt='img', caption="125px", width=125)
    # channels = [np.array(img), np.array(img), np.array(img)]
    # channels[0][:,:,1:] = 0
    # channels[1][:,:,0::2] = 0
    # channels[2][:,:,:-1] = 0
    # write.img(channels, caption=["Red", "Green", "Blue"], width=125)
    #
    # # Text
    # write('Text', fmt='header', level=3)
    #
    # write.header('Character Wrapping', level=5)
    # write(
    #     'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do ' +
    #     'eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ' +
    #     'ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut ' +
    #     'aliquip ex ea commodo consequat. Duis aute irure dolor in ' +
    #     'reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla ' +
    #     'pariatur. Excepteur sint occaecat cupidatat non proident, sunt in ' +
    #     'culpa qui officia deserunt mollit anim id est laborum.');
    #
    # write.header('Space preservation', level=5)
    # write(
    #     '...    0 leading spaces\n' +
    #     ' ...   1 leading space\n' +
    #     '  ...  2 leading spaces\n' +
    #     '   ... 3 leading spaces');
    #
    # # Progress
    # write('Progress Bars', fmt='header', level=3)
    # for percent in [100, 75, 50, 25, 0]:
    #     write(f'{percent}% progress:')
    #     write.progress(percent)
