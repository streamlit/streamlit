# -*- coding: future_fstrings -*-

#!./streamlit_run

"""Example of everything that's possible in streamlit."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

# import numpy as np
from PIL import Image
import urllib
from io import BytesIO

# import sys

import inspect
import numpy as np
import pandas as pd
import textwrap
import threading

import streamlit
import streamlit as st

try:
    FileNotFoundError
except NameError:
    FileNotFoundError = IOError

def display_reference():
    """Displays Streamlit's internal help in the browser."""

    st.title('Streamlit Quick Reference')

    st.header('The Basics')

    st.write('Import streamlit with `import streamlit as st`.')

    with st.echo():
        st.write("""
            The `write` function is Streamlit\'s bread and butter. You can use
            it to write _markdown-formatted_ text in your Streamlit report.
        """)

    with st.echo():
        the_meaning_of_life = 40 + 2;

        st.write(
            'You can also pass in comma-separated values into `write` just like '
            'with Python\'s `print`. So you can easily interpolate the values of '
            'variables like this: ', the_meaning_of_life)


    st.header('Visualizing data as tables')

    st.write('The `write` function also knows what to do when you pass a NumPy '
             'array or Pandas dataframe.')

    with st.echo():
        import numpy as np
        a_random_array = np.random.randn(200, 200)

        st.write('Here\'s a NumPy example:', a_random_array)

    st.write('And here is a dataframe example:')

    with st.echo():
        import pandas as pd
        from datetime import datetime

        arrays = [
            np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
            np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', None])]

        df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
            columns=[datetime(2012, 5, 1), datetime(2012, 5, 2), datetime(2012, 5, 3), datetime(2012, 5, 4)])

        st.write(df, '...and its transpose:', df.T)

    st.header('Visualizing data as charts')

    st.write('Charts are just as simple, but they require us to introduce some '
             'special functions first.')

    st.write('So assuming `data_frame` has been defined as...')

    with st.echo():
        chart_data = pd.DataFrame(
            np.random.randn(20, 5),
            columns=['pv', 'uv', 'a', 'b', 'c']
        )

    st.write('...you can easily draw the charts below:')


    st.subheader('Example of line chart')

    with st.echo():
        st.line_chart(chart_data)

    st.write('As you can see, each column in the dataframe becomes a different '
             'line. Also, values on the _x_ axis are the dataframe\'s indices. '
             'Which means we can customize them this way:')

    with st.echo():
        chart_data2 = pd.DataFrame(
            np.random.randn(20, 2),
            columns=['stock 1', 'stock 2'],
            index=pd.date_range('1/2/2011', periods=20, freq='M')
        )

        st.line_chart(chart_data2)


    st.subheader('Example of area chart')

    with st.echo():
        st.area_chart(chart_data)


    st.subheader('Example of bar chart')

    with st.echo():
        trimmed_data = chart_data[['pv', 'uv']].iloc[:10]
        st.bar_chart(trimmed_data)

    st.subheader('Matplotlib')

    st.write('You can use Matplotlib in Streamlit. '
        'Just use `st.pyplot()` instead of `plt.show()`.')
    try:
        with st.echo():
            from matplotlib import cm, pyplot as plt
            from mpl_toolkits.mplot3d import Axes3D

            # Create some data
            X, Y = np.meshgrid(np.arange(-5, 5, 0.25), np.arange(-5, 5, 0.25))
            Z = np.sin(np.sqrt(X**2 + Y**2))

            # Plot the surface.
            fig = plt.figure()
            ax = fig.gca(projection='3d')
            surf = ax.plot_surface(X, Y, Z, cmap=cm.coolwarm, linewidth=0)

            st.pyplot()
    except Exception as e:
        err_str = str(e)
        if err_str.startswith('Python is not installed as a framework.'):
            err_str = 'Matplotlib backend is not compatible with your Python ' \
                'installation. Please consider adding "backend: TkAgg" to your ' \
                ' ~/.matplitlib/matplotlibrc. For more information, please see ' \
                '"Working with Matplotlib on OSX" in the Matplotlib FAQ.'
        st.warning('Error running matplotlib: ' + err_str)

    st.subheader('Vega Lite')

    st.write(
        'For complex interactive charts, you can use '
        '[Vega Lite](https://vega.github.io/vega-lite/):')

    with st.echo():
        df = pd.DataFrame(np.random.randn(200, 3), columns=['a', 'b', 'c'])

        st.vega_lite_chart(df, {
            'mark': 'circle',
            'encoding': {
              'x': {'field': 'a', 'type': 'quantitative'},
              'y': {'field': 'b', 'type': 'quantitative'},
              'size': {'field': 'c', 'type': 'quantitative'},
              'color': {'field': 'c', 'type': 'quantitative'},
            },

            # Add zooming/panning:
            'selection': {
                'grid': {
                    'type': 'interval',
                    'bind': 'scales',
                },
            },
          })

    st.header('Visualizing data as images')

    @st.cache
    def read_image(url):
        return urllib.request.urlopen(url).read()
    image_url = 'https://images.fineartamerica.com/images/artworkimages/mediumlarge/1/serene-sunset-robert-bynum.jpg'
    try:
        image_bytes = read_image(image_url)

        with st.echo():
            image = Image.open(BytesIO(image_bytes))

            st.image(image, caption="Sunset", use_column_width=True)

            array = np.array(image).transpose((2, 0, 1))
            channels = array.reshape(array.shape + (1,))

            st.image(channels, caption=['Red', 'Green', 'Blue'], width=200)
    except urllib.error.URLError:
        st.error(f'Unable to load image from {image_url}. '
            'Is the internet connected?')

    st.header('Inserting headers')

    st.write(
        'To insert titles and headers like the ones on this page, use the `title`, '
        '`header`, and `subheader` functions.')


    st.header('Preformatted text')

    with st.echo():
        st.text("Here's preformatted text instead of _Markdown_!\n"
                "       ^^^^^^^^^^^^\n"
                "Rock on! \m/(^_^)\m/ ")

    st.header('JSON')

    with st.echo():
        st.json({'hello': 'world'})

    with st.echo():
        st.json('{"object":{"array":[1,true,"3"]}}')

    st.header('Inline Code Blocks')

    with st.echo():
        with st.echo():
            st.write('Use `st.echo()` to display inline code blocks.')

    st.header('Alert boxes')

    with st.echo():
        st.error("This is an error message")
        st.warning("This is a warning message")
        st.info("This is an info message")
        st.success("This is a success message")

    st.header('Progress Bars')

    with st.echo():
        for percent in [0, 25, 50, 75, 100]:
            st.write(f'{percent}% progress:')
            st.progress(percent)

    st.header('Help')

    with st.echo():
        st.help(dir)

    st.header('Out-of-Order Writing')

    st.write('Placeholders allow you to draw items out-of-order. For example:')

    with st.echo():
        st.text('A')
        placeholder = st.empty()
        st.text('C')
        placeholder.text('B')


    st.header('Exceptions')
    st.write('You can print out exceptions using `st.exception()`:')

    with st.echo():
        try:
            raise RuntimeError('An exception')
        except Exception as e:
            st.exception(e)

    st.header('Lengthy Computations')
    st.write("""
        If you're repeatedly running length computations, try caching the
        solution.

        ```python
        @streamlit.cache
        def lengthy_computation(...):
            ...

        # This runs quickly.
        answer = lengthy_computation(...)
        ```
        **Note**: `@streamlit.cache` requires that the function output
        depends *only* on its input arguments. For example, you can cache
        calls to API endpoints, but only do so if the data you get won't change.
    """)
    st.subheader('Spinners')
    st.write('A visual way of showing long computation is with a spinner:')
    lengthy_computation = lambda: None # noop for demsontration purposes

    with st.echo():
        with st.spinner('Computing something time consuming...'):
            lengthy_computation()

    st.header('Animation')
    st.write(
        'Every `streamlit.io` method (except `st.write`) returns a handle '
        'which can be used for animation.')

    with st.echo():
        import time
        my_bar = st.progress(0)

        for percent_complete in range(100):
            my_bar.progress(percent_complete + 1)
            time.sleep(0.1)
