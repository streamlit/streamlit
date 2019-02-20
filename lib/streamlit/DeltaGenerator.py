# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Allows us to create and absorb changes (aka Deltas) to elements."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import functools
import io
import json
import random
import sys
import textwrap
import traceback

from streamlit import case_converters
from streamlit import config
from streamlit import protobuf
from streamlit.Chart import Chart
from streamlit import chart_config

EXPORT_FLAG = '__export__'

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


MAX_DELTA_BYTES = 14 * 1024 * 1024  # 14MB


def _export(method):
    """Wrap function to mark method to be exported to Streamlit package.

    This is a function decorator. If using several decorators, make sure this
    is the outermost decorator, i.e. the one that is at the top.
    """
    setattr(method, EXPORT_FLAG, True)
    return method


def _wraps_with_cleaned_sig(wrapped):
    """Simplify the function signature by removing "self" and "element".

    Removes "self" and "element" from function signature, since signatures are
    visible in our user-facing docs and these elements make no sense to the
    user.
    """
    fake_wrapped = functools.partial(wrapped, None, None)
    fake_wrapped.__doc__ = wrapped.__doc__

    # These fields are used by wraps(), but in Python 2 partial() does not
    # produce them.
    fake_wrapped.__module__ = wrapped.__module__
    fake_wrapped.__name__ = wrapped.__name__

    return functools.wraps(fake_wrapped)


def _clean_up_sig(method):
    @_wraps_with_cleaned_sig(method)
    def wrapped_method(self, *args, **kwargs):
        return method(self, None, *args, **kwargs)
    return wrapped_method



def _with_element(method):
    """Wrap function and pass a NewElement proto to be filled.

    This is a function decorator.

    Converts a method of the with arguments (self, element, ...) into a method
    with arguments (self, ...). Thus, the intantiation of the element proto
    object and creation of the element are handled automaticallyself.

    Parameters
    ----------
    method : callable
        A DeltaGenerator method with arguments (self, element, ...)

    Returns
    -------
    DeltaGenerator
        A new DeltaGenerator method with arguments (self, ...)

    """
    @_wraps_with_cleaned_sig(method)
    def wrapped_method(self, *args, **kwargs):
        try:
            def marshall_element(element):
                method(self, element, *args, **kwargs)
            return self._enqueue_new_element_delta(marshall_element)
        except Exception as e:
            # First, write the delta to stderr.
            import sys
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback.print_tb(exc_traceback, file=sys.stderr)

            # Now write the delta to the report. (To avoid infinite recursion,
            # we make sure that the exception didn't occur *within* st.exception
            # itself!)
            if method.__name__ != 'exception':
                self.exception(e)

    return wrapped_method


class DeltaGenerator(object):
    """Creator of Delta protobuf messages."""

    def __init__(self, queue, id=None):
        """Constructor.

        Parameters
        ----------
        queue : callable
            Function that enqueues Deltas.
        id : int
            ID for deltas, or None to create a new generator (with new ID) each
            time.

        """
        self._queue = queue
        if id is None:
            self._generate_new_ids = True
            self._next_id = 0
        else:
            self._generate_new_ids = False
            self._id = id

    @_export
    @_with_element
    def balloons(self, element):
        """Draw celebratory balloons.

        Example
        -------
        >>> st.balloons()

        ...then watch your report and get ready for a celebration!

        """
        element.balloons.type = protobuf.Balloons.DEFAULT
        element.balloons.execution_id = random.randrange(0xFFFFFFFF)

    @_export
    @_with_element
    def text(self, element, body):
        """Write fixed-width text.

        Parameters
        ----------
        body : str
            The string to display.

        Example
        -------
        >>> st.text('This is some text.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PYxU1kee5ubuhGR11NsnT1
           height: 50px

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.PLAIN

    @_export
    @_with_element
    def markdown(self, element, body):
        """Display string formatted as Markdown.

        Parameters
        ----------
        body : str
            The string to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

        Example
        -------
        >>> st.markdown('Streamlit is **_really_ cool**.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PXz9xgY8aB88eziDVEZLyS
           height: 50px

        """
        element.text.body = textwrap.dedent(body).strip()
        element.text.format = protobuf.Text.MARKDOWN

    @_export
    @_with_element
    def json(self, element, body):
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : Object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        Example
        -------
        >>> st.json({
        ...     'foo': 'bar',
        ...     'baz': 'boz',
        ...     'stuff': [
        ...         'stuff 1',
        ...         'stuff 2',
        ...         'stuff 3',
        ...         'stuff 5',
        ...     ],
        ... })

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=CTFkMQd89hw3yZbZ4AUymS
           height: 280px

        """
        element.text.body = (
                body if isinstance(body, string_types)  # noqa: F821
                else json.dumps(body))
        element.text.format = protobuf.Text.JSON

    @_export
    @_with_element
    def title(self, element, body):
        """Display text in title formatting.

        Each document should have a single `st.title()`, although this is not
        enforced.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.title('This is a title')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=SFcBGANWd8kWXF28XnaEZj
           height: 100px

        """
        element.text.body = '# %s' % textwrap.dedent(body).strip()
        element.text.format = protobuf.Text.MARKDOWN

    @_export
    @_with_element
    def header(self, element, body):
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.header('This is a header')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=AnfQVFgSCQtGv6yMUMUYjj
           height: 100px

        """
        element.text.body = '## %s' % textwrap.dedent(body).strip()
        element.text.format = protobuf.Text.MARKDOWN

    @_export
    @_with_element
    def subheader(self, element, body):
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.subheader('This is a subheader')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=LBKJTfFUwudrbWENSHV6cJ
           height: 100px

        """
        element.text.body = '### %s' % textwrap.dedent(body).strip()
        element.text.format = protobuf.Text.MARKDOWN

    @_export
    @_with_element
    def error(self, element, body):
        """Display error message.

        Parameters
        ----------
        body : str
            The error text to display.

        Example
        -------
        >>> st.error('This is an error')

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.ERROR

    @_export
    @_with_element
    def warning(self, element, body):
        """Display warning message.

        Parameters
        ----------
        body : str
            The warning text to display.

        Example
        -------
        >>> st.warning('This is a warning')

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.WARNING

    @_export
    @_with_element
    def info(self, element, body):
        """Display an informational message.

        Parameters
        ----------
        body : str
            The info text to display.

        Example
        -------
        >>> st.info('This is a purely informational message')

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.INFO

    @_export
    @_with_element
    def success(self, element, body):
        """Display a success message.

        Parameters
        ----------
        body : str
            The success text to display.

        Example
        -------
        >>> st.warning('This is a success message!')

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.SUCCESS

    @_export
    def link(self, *args, **kwargs):
        """Create an element showing a link. DEPRECATED.

        Parameters
        ----------
        body : str
            The link.

        """
        raise RuntimeError(
            'Link() is deprecated. Please use markdown() instead.')

    @_export
    @_with_element
    def help(self, element, obj):
        """Display object's doc string, nicely formatted.

        Displays the doc string for this object.

        Parameters
        ----------
        obj : Object
            The object whose docstring should be displayed.

        Example
        -------

        Don't remember how to initialize a dataframe? Try this:

        >>> st.help(pandas.DataFrame)

        Want to quickly check what datatype is output by a certain function?
        Try:

        >>> x = my_poorly_documented_function()
        >>> st.help(x)

        """
        from streamlit import doc_string
        doc_string.marshall(element, obj)

    @_export
    @_with_element
    def exception(self, element, exception, exception_traceback=None):
        """Display an exception.

        Parameters
        ----------
        exception : Exception
            The exception to display.
        exception_traceback : Exception Traceback or None
            If None or False, does not show display the trace. If True,
            tries to capture a trace automatically. If a Traceback object,
            displays the given traceback.

        Example
        -------
        >>> e = RuntimeError('This is an exception of type RuntimeError')
        >>> st.exception(e)

        """
        element.exception.type = type(exception).__name__
        element.exception.message = str(exception)

        # Get and extract the traceback for the exception.
        if exception_traceback is not None:
            extracted_traceback = traceback.extract_tb(exception_traceback)
        elif hasattr(exception, '__traceback__'):
            # This is the Python 3 way to get the traceback.
            extracted_traceback = traceback.extract_tb(exception.__traceback__)
        else:
            # Hack for Python 2 which will extract the traceback as long as this
            # method was called on the exception as it was caught, which is
            # likely what the user would do.
            _, live_exception, live_traceback = sys.exc_info()
            if exception == live_exception:
                extracted_traceback = traceback.extract_tb(live_traceback)
            else:
                extracted_traceback = None

        # Format the extracted traceback and add it to the protobuf element.
        if extracted_traceback is None:
            stack_trace = [
                'Cannot extract the stack trace for this exception. '
                'Try calling exception() within the `catch` block.']
        else:
            stack_trace = traceback.format_list(extracted_traceback)
        element.exception.stack_trace.extend(stack_trace)

    @_export
    @_with_element
    def _text_exception(self, element, exception_type, message, stack_trace):
        """Display an exception.

        Parameters
        ----------
        exception_type : str
        message : str
        stack_trace : list of str

        """
        element.exception.type = exception_type
        element.exception.message = message
        element.exception.stack_trace.extend(stack_trace)

    @_export
    @_clean_up_sig
    def dataframe(self, _, df):
        """Display a dataframe as an interactive table.

        Parameters
        ----------
        df : Panda.DataFrame, Numpy.Array, or list
            The dataframe to display.

        Example
        -------
        >>> df = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> st.dataframe(df)  # Same as st.write(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=165mJbzWdAC8Duf8a4tjyQ
           height: 330px

        """
        from streamlit import data_frame_proto
        def set_data_frame(delta):
            data_frame_proto.marshall_data_frame(
                df, delta.data_frame)
        return self._enqueue_new_element_delta(set_data_frame)

    def _native_chart(self, chart):
        """Display a chart."""
        def set_chart(delta):
            chart.marshall(delta.chart)
        return self._enqueue_new_element_delta(set_chart)

    @_export
    @_with_element
    def vega_lite_chart(self, element, data=None, spec=None, **kwargs):
        """Display a chart using the Vega Lite library.

        Parameters
        ----------
        data : list, numpy.ndarray, pandas.DataFrame or None
            Data to be plotted. May also be passed inside the spec dict, to
            more closely follow the Vega Lite API.

        spec : dict
            The Vega Lite spec for the chart. See
            https://vega.github.io/vega-lite/docs/ for more info.

        **kwargs : any
            Same as spec, but as keywords.

        Example
        -------

        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        >>>
        >>> st.vega_lite_chart(df, {
        ...     'mark': 'circle',
        ...     'encoding': {
        ...         'x': {'field': 'a', 'type': 'quantitative'},
        ...         'y': {'field': 'b', 'type': 'quantitative'},
        ...         'size': {'field': 'c', 'type': 'quantitative'},
        ...         'color': {'field': 'c', 'type': 'quantitative'},
        ...     },
        ... })

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Vega Lite usage without Streamlit can be found at
        https://vega.github.io/vega-lite/examples/. Most of those can be easily
        translated to the syntax shown above.

        """
        from streamlit import vega_lite
        vega_lite.marshall(
            element.vega_lite_chart, data, spec, **kwargs)

    @_export
    @_with_element
    def altair_chart(self, element, altair_chart):
        """Display a chart using the Altair library.

        Parameters
        ----------
        altair_chart : altair.vegalite.v2.api.Chart
            The Altair chart object to display.

        Example
        -------

        >>> import pandas as pd
        >>> import numpy as np
        >>> import altair as alt
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(200, 3),
        ...     columns=['a', 'b', 'c'])
        ...
        >>> c = alt.Chart(df).mark_circle().encode(
        ...     x='a', y='b', size='c', color='c')
        >>>
        >>> st.altair_chart(c)

        .. output::
           http://share.streamlit.io/0.25.0-2JkNY/index.html?id=8jmmXR8iKoZGV4kXaKGYV5
           height: 200px

        Examples of Altair charts can be found at
        https://altair-viz.github.io/gallery/.

        """
        from streamlit import vega_lite
        vega_lite.marshall(element.vega_lite_chart, altair_chart.to_dict())

    @_export
    @_with_element
    def pyplot(self, element, fig=None, **kwargs):
        """Display a matplotlib.pyplot image.

        Parameters
        ----------
        fig : Matplotlib Figure
            The figure to plot. When this argument isn't specified, which is
            the usual case, this function will render the global plot.

        **kwargs : any
            Arguments to pass to Matplotlib's savefig function.

        Example
        -------
        >>> import matplotlib.pyplot as plt
        >>> import numpy as np
        >>>
        >>> arr = np.random.normal(1, 1, size=100)
        >>> plt.hist(arr, bins=20)
        >>>
        >>> st.pyplot()

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PwzFN7oLZsvb6HDdwdjkRB
           height: 530px

        Notes
        -----
        Matplotlib support several different types of "backends". If you're
        getting an error using Matplotlib with Streamlit, try setting your
        backend to "TkAgg"::

            echo "backend: TkAgg" >> ~/.matplotlib/matplotlibrc

        For more information, see https://matplotlib.org/faq/usage_faq.html.

        """
        from streamlit import image_proto
        try:
            import matplotlib  # noqa: F401
            import matplotlib.pyplot as plt
            plt.ioff()
        except ImportError:
            raise ImportError(f'pyplot() command requires matplotlib')

        # You can call .savefig() on a Figure object or directly on the pyplot
        # module, in which case you're doing it to the latest Figure.
        if not fig:
            fig = plt

        # Normally, dpi is set to 'figure', and the figure's dpi is set to 100.
        # So here we pick double of that to make things look good in a high
        # DPI display.
        dpi = kwargs.get('dpi', 200)

        image = io.BytesIO()
        fig.savefig(image, format='png', dpi=dpi)
        image_proto.marshall_images(
            image, None, -2, element.imgs, False)

    # TODO: Make this accept files and strings/bytes as input.
    @_export
    @_with_element
    def image(
            self, element, image, caption=None, width=None,
            use_column_width=False, clamp=False):
        """Display an image or list of images.

        Parameters
        ----------
        image : numpy.ndarray, list of numpy.ndarray, or BytesIO
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
            OR an RGBA image of shape (w,h,4)
            OR a list of one of the above, to display multiple images.
        caption : str or list of str
            Image caption. If displaying multiple images, caption should be a
            list of captions (one for each image).
        width : int or None
            Image width. None means use the image width.
        use_column_width : bool
            If True, set the image width to the column width. This overrides
            the `width` parameter.
        clamp : bool
            Clamp the image to the given range.

        Example
        -------
        >>> from PIL import Image
        >>> image = Image.open('sunrise.jpg')
        >>>
        >>> st.image(image, caption='Sunrise by the mountains',
        ...          use_column_width=True)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=YCFaqPgmgpEz7jwE4tHAzY
           height: 630px

        """
        from streamlit import image_proto
        if use_column_width:
            width = -2
        elif width is None:
            width = -1
        elif width <= 0:
            raise RuntimeError('Image width must be positive.')
        image_proto.marshall_images(
            image, caption, width, element.imgs, clamp)

    # TODO: remove `img()`, now replaced by `image()`
    @_export
    def img(self, *args, **kwargs):
        """Display an image or list of images. DEPRECATED."""
        raise RuntimeError('DEPRECATED. Please use image() instead.')

    @_export
    @_with_element
    def audio(self, element, data, format='audio/wav'):
        """Display an audio player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            The audio data. Must include headers and any other bytes required
            in the actual file.
        format : str
            The mime type for the audio file. Defaults to 'audio/wav'.
            See https://tools.ietf.org/html/rfc4281 for more info.

        Example
        -------
        >>> audio_file = open('myaudio.ogg', 'rb')
        >>> audio_bytes = audio_file.read()
        >>>
        >>> st.audio(audio_bytes, format='audio/ogg')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=Dv3M9sA7Cg8gwusgnVNTHb
           height: 400px

        """
        # TODO: Provide API to convert raw NumPy arrays to audio file (with
        # proper headers, etc)?
        from streamlit import generic_binary_proto
        generic_binary_proto.marshall(element.audio, data)
        element.audio.format = format

    @_export
    @_with_element
    def video(self, element, data, format='video/mp4'):
        """Display a video player.

        Parameters
        ----------
        data : str, bytes, BytesIO, numpy.ndarray, or file opened with
                io.open().
            Must include headers and any other bytes required in the actual
            file.
        format : str
            The mime type for the video file. Defaults to 'video/mp4'.
            See https://tools.ietf.org/html/rfc4281 for more info.

        Example
        -------
        >>> video_file = open('myvideo.mp4', 'rb')
        >>> video_bytes = video_file.read()
        >>>
        >>> st.video(video_bytes)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=Wba9sZELKfKwXH4nDCCbMv
           height: 600px

        """
        # TODO: Provide API to convert raw NumPy arrays to video file (with
        # proper headers, etc)?
        from streamlit import generic_binary_proto
        generic_binary_proto.marshall(element.video, data)
        element.video.format = format

    @_export
    @_with_element
    def progress(self, element, value):
        """Display a progress bar.

        Parameters
        ----------
        value : int
            The percentage complete: 0 <= value <= 100

        Example
        -------
        Here is an example of a progress bar increasing over time:

        >>> import time
        >>>
        >>> my_bar = st.progress(0)
        >>>
        >>> for percent_complete in range(100):
        ...     my_bar.progress(percent_complete + 1)

        """
        element.progress.value = value

    @_export
    @_with_element
    def empty(self, element):
        """Add a placeholder to the report.

        The placeholder can be filled any time by calling methods on the return
        value.

        Example
        -------
        >>> my_placeholder = st.empty()
        >>>
        >>> # Now replace the placeholder with some text:
        >>> my_placeholder.text("Hello world!")
        >>>
        >>> # And replace the text with an image:
        >>> my_placeholder.image(my_image_bytes)

        """
        # The protobuf needs something to be set
        element.empty.unused = True

    @_export
    @_with_element
    def map(self, element, points):
        """Display a map with points on it.

        Parameters
        ----------
        points : Panda.DataFrame, Numpy.Array, or list
            The points to display. Must have 'lat' and 'lon' columns.

        Example
        -------
        >>> import pandas as pd
        >>> import numpy as np
        >>>
        >>> df = pd.DataFrame(
        ...     np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...     columns=['lat', 'lon'])
        >>>
        >>> st.map(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=7Sr8jMkKDc6E6Y5y2v2MNk
           height: 600px

        """
        from streamlit import data_frame_proto
        LAT_LON = ['lat', 'lon']
        assert set(points.columns) >= set(LAT_LON), \
            'Map points must contain "lat" and "lon" columns.'
        data_frame_proto.marshall_data_frame(
            points[LAT_LON], element.map.points)

    @_export
    @_with_element
    def deck_gl_chart(self, element, data=None, spec=None, **kwargs):
        """Draw a map chart using the Deck.GL library.

        This API closely follows Deck.GL's JavaScript API
        (https://deck.gl/#/documentation), with a few small adaptations and
        some syntax sugar.

        Parameters
        ----------

        data : list or Numpy Array or DataFrame or None
            Data to be plotted, if no layer specified.

        spec : dict
            Keys in this dict can be:

            - Anything accepted by Deck.GL's top level element, such as
              "viewport", "height", "width".

            - "layers": a list of dicts containing information to build a new
              Deck.GL layer in the map. Each layer accepts the following keys:

                - "data" : DataFrame
                  The data for the current layer.

                - "type" : str
                  A layer type accepted by Deck.GL, such as "HexagonLayer",
                  "ScatterplotLayer", "TextLayer"

                - "encoding" : dict
                  A mapping connecting specific fields in the dataset to
                  properties of the chart. The exact keys that are accepted
                  depend on the "type" field, above.

                  For example, Deck.GL"s documentation for ScatterplotLayer
                  shows you can use a "getRadius" field to individually set
                  the radius of each circle in the plot. So here you would
                  set "encoding": {"getRadius": "my_column"} where
                  "my_column" is the name of the column containing the radius
                  data.

                  For things like "getPosition", which expect an array rather
                  than a scalar value, we provide alternates that make the
                  API simpler to use with dataframes:

                  - Instead of "getPosition" : use "getLatitude" and
                    "getLongitude".
                  - Instead of "getSourcePosition" : use "getLatitude" and
                    "getLongitude".
                  - Instead of "getTargetPosition" : use "getTargetLatitude"
                    and "getTargetLongitude".
                  - Instead of "getColor" : use "getColorR", "getColorG",
                    "getColorB", and (optionally) "getColorA", for red,
                    green, blue and alpha.
                  - Instead of "getSourceColor" : use the same as above.
                  - Instead of "getTargetColor" : use "getTargetColorR", etc.

                - Plus anything accepted by that layer type. For example, for
                  ScatterplotLayer you can set fields like "opacity", "filled",
                  "stroked", and so on.

        **kwargs : any
            Same as spec, but as keywords. Keys are "unflattened" at the
            underscore characters. For example, foo_bar_baz=123 becomes
            foo={'bar': {'bar': 123}}.

        Example
        -------
        For convenience, if you pass in a dataframe and no spec, you get a
        scatter plot:

        >>> df = pd.DataFrame(
        ...    np.random.randn(1000, 2) / [50, 50] + [37.76, -122.4],
        ...    columns=['lat', 'lon'])
        ...
        >>> st.deck_gl_chart(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=AhGZBy2qjzmWwPxMatHoB9
           height: 530px

        The dataframe must have columns called 'lat'/'latitude' or
        'lon'/'longitude'.

        If you want to do something more interesting, pass in a spec with its
        own data, and no top-level dataframe. For instance:

        >>> st.deck_gl_chart(
        ...     viewport={
        ...         'latitude': 37.76,
        ...         'longitude': -122.4,
        ...         'zoom': 11,
        ...         'pitch': 50,
        ...     },
        ...     layers=[{
        ...         'type': 'HexagonLayer',
        ...         'data': df,
        ...         'radius': 200,
        ...         'elevationScale': 4,
        ...         'elevationRange': [0, 1000],
        ...         'pickable': True,
        ...         'extruded': True,
        ...     }, {
        ...         'type': 'ScatterplotLayer',
        ...         'data': df,
        ...     }])
        ...

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=ASTdExBpJ1WxbGceneKN1i
           height: 530px

        """
        from streamlit import deck_gl
        deck_gl.marshall(element.deck_gl_chart, data, spec, **kwargs)

    @_export
    @_with_element
    def table(self, element, df=None):
        """Display a static table.

        This differs from `st.dataframe` in that the table in this case is
        static: its entire contents are just layed out directly on the page.

        Parameters
        ----------
        df : Panda.DataFrame, Numpy.Array, or list
            The table data.

        Example
        -------
        >>> df = pd.DataFrame(
        ...    np.random.randn(10, 5),
        ...    columns=('col %d' % i for i in range(5)))
        ...
        >>> st.table(df)

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=KfZvDMprL4JFKXbpjD3fpq
           height: 480px

        """
        from streamlit import data_frame_proto
        data_frame_proto.marshall_data_frame(df, element.table)

    def add_rows(self, df):
        """Concatenate a dataframe to the bottom of the current one.

        Parameters
        ----------
        df : Panda.DataFrame, Numpy.Array, or list
            The table to concat.

        Example
        -------
        >>> df1 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table = st.table(df1)
        >>>
        >>> df2 = pd.DataFrame(
        ...    np.random.randn(50, 20),
        ...    columns=('col %d' % i for i in range(20)))
        ...
        >>> my_table.add_rows(df2)
        >>> # Now the table shown in the Streamlit report contains the data for
        >>> # df1 followed by the data for df2.

        And you can do the same with plots. For example, if you want to add
        more data to a line chart:

        >>> # Assuming df1 and df2 from the example above still exist...
        >>> my_chart = st.line_chart(df1)
        >>> my_chart.add_rows(df2)
        >>> # Now the chart shown in the Streamlit report contains the data for
        >>> # df1 followed by the data for df2.

        """
        from streamlit import data_frame_proto
        assert not self._generate_new_ids, \
            'Only existing elements can add_rows.'
        delta = protobuf.Delta()
        delta.id = self._id
        data_frame_proto.marshall_data_frame(df, delta.add_rows)
        self._queue(delta)
        return self

    def _enqueue_new_element_delta(self, marshall_element):
        """Create NewElement delta, fill it, and enqueue it.

        Parameters
        ----------
        marshall_element : callable
            Function which sets the fields for a protobuf.Delta.

        Returns
        -------
        DeltaGenerator
            A DeltaGenerator that can be used to modify the newly-created
            element.

        """
        # "Null" delta generators (those wihtout queues), don't send anything.
        if self._queue is None:
            return self

        # Create a delta message.
        delta = protobuf.Delta()
        marshall_element(delta.new_element)

        # Figure out if we need to create a new ID for this element.
        if self._generate_new_ids:
            delta.id = self._next_id
            generator = DeltaGenerator(self._queue, delta.id)
            self._next_id += 1
        else:
            delta.id = self._id
            generator = self

        self._queue(delta)
        return generator


def _register_native_chart_method(chart_type):
    """Add a chart-building method to DeltaGenerator for a specific chart type.

    Parameters
    ----------
    chart_type : str
        The snake-case name of the chart type to add.

    """
    @_export
    @_wraps_with_cleaned_sig(Chart.__init__)
    def chart_method(self, data, **kwargs):
        return self._native_chart(Chart(data, type=chart_type, **kwargs))

    setattr(DeltaGenerator, chart_type, chart_method)


# Add chart-building methods to DeltaGenerator
for chart_type in chart_config.CHART_TYPES:
    _register_native_chart_method(case_converters.to_snake_case(chart_type))
