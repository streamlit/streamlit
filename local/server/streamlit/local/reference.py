#!./streamlit_run

"""Example of everything that's possible in streamlit."""

# import numpy as np
from PIL import Image
import urllib
from io import BytesIO

# import sys

import inspect
import numpy as np
import pandas as pd
import textwrap

import streamlit
from streamlit import io

def render(func):
    """Displays the function body as a code block, the executes the function.

    Args
    ----
    func : function
        A function which will be pretty-printed and then executed.
    """
    source = inspect.getsource(func)
    if source.strip().startswith('render(lambda'):
        source = source[:-2]
    source = source[source.find(':') + 1:]
    source = textwrap.dedent(source).strip()
    io.markdown(f'```\n{source}\n```')
    func()

def display_reference():
    """Displays Streamlit's internal help in the browser."""
    io.title('Streamlit Quick Reference')

    io.header('The Basics')

    @render
    def write_example():
        from streamlit import io
        io.write("""
            The `write` function is Streamlit\'s bread and butter. You can use
            it to write _markdown-formatted_ text in your Streamlit report.
        """)

    @render
    def write_example2():
        the_meaning_of_life = 40 + 2;

        io.write(
            'You can also pass in comma-separated values into `write` just like '
            'with Python\'s `print`. So you can easily interpolate the values of '
            'variables like this: ', the_meaning_of_life)


    io.header('Visualizing data as tables')

    io.write('The `write` function also knows what to do when you pass a NumPy '
             'array or Pandas dataframe.')

    @render
    def numpy_example():
        import numpy as np
        a_random_array = np.random.randn(200, 200)

        io.write('Here\'s a NumPy example:', a_random_array)

    io.write('And here is a dataframe example:')

    @render
    def dataframe_example():
        import pandas as pd
        from datetime import datetime

        arrays = [
            np.array(['bar', 'bar', 'baz', 'baz', 'foo', 'foo', 'qux', 'qux']),
            np.array(['one', 'two', 'one', 'two', 'one', 'two', 'one', 'two'])]

        df = pd.DataFrame(np.random.randn(8, 4), index=arrays,
            columns=[datetime(2012, 5, 1), datetime(2012, 5, 2), datetime(2012, 5, 3), datetime(2012, 5, 4)])

        io.write(df, '...and its transpose:', df.T)


    io.header('Visualizing data as charts')

    io.write('Charts are just as simple, but they require us to introduce some '
             'special functions first.')

    io.write('So assuming `data_frame` has been defined as...')

    chart_data = pd.DataFrame(
        np.random.randn(20, 5),
        columns=['pv', 'uv', 'a', 'b', 'c']
    )

    io.markdown(f'''```
    chart_data = pd.DataFrame(
        np.random.randn(20, 5),
        columns=['pv', 'uv', 'a', 'b', 'c']
    )\n```''')

    io.write('...you can easily draw the charts below:')


    io.subheader('Example of line chart')

    @render
    def chart_example1():
        io.line_chart(chart_data)

    io.write('As you can see, each column in the dataframe becomes a different '
             'line. Also, values on the _x_ axis are the dataframe\'s indices. '
             'Which means we can customize them this way:')

    @render
    def chart_example2():
        chart_data2 = pd.DataFrame(
            np.random.randn(20, 2),
            columns=['stock 1', 'stock 2'],
            index=pd.date_range('1/2/2011', periods=20, freq='M')
        )

        io.line_chart(chart_data2)


    io.subheader('Example of area chart')

    @render
    def chart_example3():
        io.area_chart(chart_data)


    io.subheader('Example of bar chart')

    @render
    def chart_example3():
        trimmed_data = chart_data[['pv', 'uv']].iloc[:10]
        io.bar_chart(trimmed_data)


    io.header('Visualizing data as images')

    @streamlit.cache
    def read_image(url):
        return urllib.request.urlopen(url).read()
    image_url = 'https://www.psdbox.com/wp-content/uploads/2014/08/HDR-landscape-tutorial-A.jpg'
    try:
        image_bytes = read_image(image_url)

        @render
        def image_example():
            image = Image.open(BytesIO(image_bytes))

            io.image(image, caption="Sunset", width=400)

            array = np.array(image).transpose((2, 0, 1))
            channels = array.reshape(array.shape + (1,))

            io.image(channels, caption=['Red', 'Green', 'Blue'], width=200)
    except urllib.error.URLError:
        io.error(f'Unable to load image from {image_url}. '
            'Is the internet connected?')

    io.header('Inserting headers')

    io.write(
        'To insert titles and headers like the ones on this page, use the `title`, '
        '`header`, and `subheader` functions.')


    io.header('Preformatted text')

    @render
    def text_example():
        io.text('You can also write preformatted text instead of _Markdown_!\n'
                '                   ^^^^^^^^^^^^\n'
                'Rock on! \m/(^_^)\m/ ')


    io.header('JSON')

    render(lambda: io.json({'hello': 'world'}))
    render(lambda: io.json('{"object":{"array":[1,true,"3"]}}'))


    io.header('Alert boxes')

    @render
    def alert_examples():
        io.error("This is an error message")
        io.warning("This is a warning message")
        io.info("This is an info message")
        io.success("This is a success message")


    io.header('Progress Bars')

    @render
    def progress_example():
        for percent in [0, 25, 50, 75, 100]:
            io.write(f'{percent}% progress:')
            io.progress(percent)

    io.header('Help')

    render(lambda: io.help(dir))

    io.header('Out-of-Order Writing')

    io.write('Placeholders allow you to draw items out-of-order. For example:')

    @render
    def empty_example():
        io.text('A')
        placeholder = io.empty()
        io.text('C')
        placeholder.text('B')


    io.header('Exceptions')
    io.write('You can print out exceptions using `io.exception()`:')
    @render
    def exception_example():
        try:
            raise RuntimeError('An exception')
        except Exception as e:
            io.exception(e)

    io.header('Lengthy Computations')
    io.write("""
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
    io.subheader('Spinners')
    io.write('A visual way of showing long computation is with a spinner:')
    lengthy_computation = lambda: None # noop for demsontration purposes
    @render
    def spinner_example():
        with io.spinner('Computing something time consuming...'):
            lengthy_computation()

    io.header('Animation')
    io.write(
        'Every `streamlit.io` method (except `io.write`) returns a handle '
        'which can be used for animation.')

    @render
    def progress_animation_example():
        import time
        my_bar = io.progress(0)

        for percent_complete in range(100):
            my_bar.progress(percent_complete + 1)
            time.sleep(0.1)
