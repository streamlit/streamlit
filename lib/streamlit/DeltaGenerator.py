# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""Allows us to create and absorb changes (aka Deltas) to elements."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

from functools import wraps
import io
import json
import random
import sys
import textwrap
import traceback

from streamlit import config
from streamlit import protobuf
from streamlit.Chart import Chart
from streamlit.caseconverters import to_snake_case
from streamlit.chartconfig import CHART_TYPES

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


def _create_element(method):
    """Wrap function to easily create a Delta-generating method.

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
    @wraps(method)
    def wrapped_method(self, *args, **kwargs):
        try:
            def create_element(element):
                method(self, element, *args, **kwargs)
            return self._new_element(create_element)
        except Exception as e:
            self.exception(e)
            import sys
            exc_type, exc_value, exc_traceback = sys.exc_info()
            traceback.print_tb(exc_traceback, file=sys.stderr)

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
    @_create_element
    def balloons(self, element):
        """Draw celebratory balloons."""
        element.balloons.type = protobuf.Balloons.DEFAULT
        element.balloons.execution_id = random.randrange(0xFFFFFFFF)

    @_export
    @_create_element
    def text(self, element, body):
        """Write fixed-width text.

        Parameters
        ----------
        body : str
            The string to display.

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.PLAIN

    @_export
    @_create_element
    def markdown(self, element, body):
        """Display string formatted as Markdown.

        Parameters
        ----------
        body : str
            The string to display as Markdown.

        """
        element.text.body = textwrap.dedent(body).strip()
        element.text.format = protobuf.Text.MARKDOWN

    @_export
    @_create_element
    def json(self, element, body):
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : Object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        """
        element.text.body = (
                body if isinstance(body, string_types)  # noqa: F821
                else json.dumps(body))
        element.text.format = protobuf.Text.JSON

    @_export
    @_create_element
    def title(self, element, string):
        """Display string in title formatting.

        Parameters
        ----------
        string : str
            The string to display.

        """
        element.text.body = str(string)
        element.text.format = protobuf.Text.TITLE

    @_export
    @_create_element
    def header(self, element, string):
        """Display string in header formatting.

        Parameters
        ----------
        string : str
            The string to display.

        """
        element.text.body = str(string)
        element.text.format = protobuf.Text.HEADER

    @_export
    @_create_element
    def subheader(self, element, string):
        """Display string in subheader formatting.

        Parameters
        ----------
        string : str
            The string to display.

        """
        element.text.body = str(string)
        element.text.format = protobuf.Text.SUB_HEADER

    @_export
    @_create_element
    def error(self, element, body):
        """Display error message.

        Parameters
        ----------
        body : str
            The error text to display.

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.ERROR

    @_export
    @_create_element
    def warning(self, element, body):
        """Display warning message.

        Parameters
        ----------
        body : str
            The warning text to display.

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.WARNING

    @_export
    @_create_element
    def info(self, element, body):
        """Display an informational message.

        Parameters
        ----------
        body : str
            The info text to display.

        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.INFO

    @_export
    @_create_element
    def success(self, element, body):
        """Display a success message.

        Parameters
        ----------
        body : str
            The success text to display.

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
        raise RuntimeError('Link() is deprecated. Please use markdown() instead.')

    @_export
    @_create_element
    def help(self, element, obj):
        """Display object's doc string, nicely formatted.

        Displays the doc string for this object. If the doc string is
        represented as ReStructuredText, then it will be converted to
        Markdown in the browser before display.

        Parameters
        ----------
        obj : Object
            The object whose docstring should be displayed.

        Example
        -------
        To learn how the st.write function works, call::

            st.help(st.write)

        """
        if not hasattr(obj, '__name__'):
            raise RuntimeError(f'help() expects module or method, not type `{type(obj).__name__}`')
        element.doc_string.name = obj.__name__
        try:
            element.doc_string.module = obj.__module__
        except AttributeError:
            pass
        doc_string = obj.__doc__
        if not isinstance(doc_string, string_types):  # noqa: F821
            doc_string = f'No docs available.'
        element.doc_string.doc_string = textwrap.dedent(doc_string).strip()

    @_export
    @_create_element
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
    @_create_element
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
    def dataframe(self, df):
        """Display a dataframe.

        Parameters
        ----------
        df : Panda.DataFrame, Numpy.Array, or list
            The dataframe to display.

        """
        from streamlit import data_frame_proto
        def set_data_frame(element):
            data_frame_proto.marshall_data_frame(df, element.data_frame)
        return self._new_element(set_data_frame)

    def _native_chart(self, chart):
        """Display a chart."""
        def set_chart(element):
            chart.marshall(element.chart)
        return self._new_element(set_chart)

    @_export
    @_create_element
    def vega_lite_chart(self, element, data=None, spec=None, **kwargs):
        """Display a chart using the Vega Lite library.

        Parameters
        ----------
        data : list, numpy.ndarray, pandas.DataFrame or None
            Data to be plotted.

        spec : dict
            The Vega Lite spec for the chart.

        **kwargs : any
            Same as spec, but as keywords. Keys are "unflattened" at the
            underscore characters. For example, foo_bar_baz=123 becomes
            foo={'bar': {'bar': 123}}.

        """
        from streamlit import VegaLiteChart
        VegaLiteChart.marshall(element.vega_lite_chart, data, spec, **kwargs)

    @_export
    @_create_element
    def pyplot(self, element, fig=None):
        """Display a matplotlib.pyplot image.

        Parameters
        ----------
        fig : Matplotlib Figure
            The figure to plot. When this argument isn't specified, which is
            the usual case, this function will render the global plot.

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

        image = io.BytesIO()
        fig.savefig(image, format='png')
        image_proto.marshall_images(image, None, -2, element.imgs, False)

    # TODO: Make this accept files and strings/bytes as input.
    @_export
    @_create_element
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

        """
        from streamlit import image_proto
        if use_column_width:
            width = -2
        elif width is None:
            width = -1
        elif width <= 0:
            raise RuntimeError('Image width must be positive.')
        image_proto.marshall_images(image, caption, width, element.imgs, clamp)

    # TODO: remove `img()`, now replaced by `image()`
    @_export
    def img(self, *args, **kwargs):
        """Display an image or list of images. DEPRECATED."""
        raise RuntimeError('DEPRECATED. Please use image() instead.')

    @_export
    @_create_element
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

        """
        # TODO: Provide API to convert raw NumPy arrays to audio file (with
        # proper headers, etc)?
        from streamlit import generic_binary_proto
        generic_binary_proto.marshall(element.audio, data)
        element.audio.format = format

    @_export
    @_create_element
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

        """
        # TODO: Provide API to convert raw NumPy arrays to video file (with
        # proper headers, etc)?
        from streamlit import generic_binary_proto
        generic_binary_proto.marshall(element.video, data)
        element.video.format = format

    @_export
    @_create_element
    def progress(self, element, value):
        """Display a progress bar.

        Parameters
        ----------
        value : int
            The percentage complete: 0 <= value <= 100

        Examples
        --------
        Here is an example of a progress bar increasing over time:
            import time
            my_bar = st.progress(0)
            for percent_complete in range(100):
                my_bar.progress(percent_complete + 1)

        """
        element.progress.value = value

    @_export
    @_create_element
    def empty(self, element):
        """Add a placeholder to the report.

        The placeholder can be filled any time by calling methods on the return
        value.

        Examples
        --------
        ::
            my_placeholder = st.empty()

            # Replace image with some text.
            my_placeholder.text("Hello world!")

            # Replace the placeholder with an image.
            my_placeholder.image(my_image_bytes)

        """
        # The protobuf needs something to be set
        element.empty.unused = True

    @_export
    @_create_element
    def map(self, element, points):
        """Display a map with points on it.

        Parameters
        ----------
        points : Panda.DataFrame, Numpy.Array, or list
            The points to display. Must have 'lat' and 'lon' columns.

        """
        from streamlit import data_frame_proto
        LAT_LON = ['lat', 'lon']
        assert set(points.columns) >= set(LAT_LON), \
            'Map points must contain "lat" and "lon" columns.'
        data_frame_proto.marshall_data_frame(
            points[LAT_LON], element.map.points)

    @_export
    @_create_element
    def deck_gl_chart(self, element, data=None, spec=None, **kwargs):
        """Draw a map chart using the DeckGL library.

        See https://deck.gl/#/documentation for more info.

        Parameters
        ----------
        data : list or Numpy Array or DataFrame or None
            Data to be plotted, if no layer specified.

        spec : dict
            Keys/values in this dict can be:
            - Anything accepted by DeckGl's top level element.
            - "layers": a list of dicts containing information to build a new
              DeckGl layer in the map. Each layer accepts the following keys:
                - "data" : DataFrame
                    The data for that layer.
                - "type" : str - a layer type accepted by DeckGl
                    The layer type, such as 'HexagonLayer', 'ScatterplotLayer',
                    etc.
                - "encoding" : dict - Accessors accepted by that layer type.
                  The keys should be the accessor name without the "get"
                  prefix. For example instead of "getColor" you should
                  useinstead of "getColor" you should use "color". If strings,
                  these get automatically transformed into getters for that
                  column.
                - And anything accepted by that layer type

        **kwargs : any
            Same as spec, but as keywords. Keys are "unflattened" at the
            underscore characters. For example, foo_bar_baz=123 becomes
            foo={'bar': {'bar': 123}}.

        Examples
        --------
            # If you pass in a dataframe and no spec, you get a scatter plot.
            st.deck_gl_chart(my_data_frame)

            # For anything else, pass in a spec and no top-level dataframe. For
            # instance:
            st.deck_gl_chart(
                viewport={
                    'latitude': 37.76,
                    'longitude': -122.4,
                    'zoom': 11,
                    'pitch': 50,
                },
                layers=[{
                    'type': 'HexagonLayer',
                    'data': my_dataframe,
                    'radius': 200,
                    'elevationScale': 4,
                    'elevationRange': [0, 1000],
                    'pickable': True,
                    'extruded': True,
                }, {
                    'type': 'ScatterplotLayer',
                    'data': my_other_dataframe,
                    'pickable': True,
                    'autoHighlight': True,
                    'radiusScale': 0.02,
                    'encoding': {
                        'radius': 'exits',
                    },
                }])

        """
        from streamlit import DeckGlChart
        DeckGlChart.marshall(element.deck_gl_chart, data, spec, **kwargs)

    @_export
    @_create_element
    def table(self, element, df):
        """Display a static table.

        Parameters
        ----------
        df : Panda.DataFrame, Numpy.Array, or list
            The table data.

        """
        from streamlit import data_frame_proto
        data_frame_proto.marshall_data_frame(df, element.table)

    def add_rows(self, df):
        """Concat dataframes to the bottom of another.

        Parameters
        ----------
        df : Panda.DataFrame, Numpy.Array, or list
            The table to concat.

        """
        from streamlit import data_frame_proto
        assert not self._generate_new_ids, \
            'Only existing elements can add_rows.'
        delta = protobuf.Delta()
        delta.id = self._id
        data_frame_proto.marshall_data_frame(df, delta.add_rows)
        self._queue(delta)
        return self

    def _new_element(self, set_element):
        """Create new element delta, fills it, and dispatch it.

        Parameters
        ----------
        set_element : callable
            Function which sets the fields for a protobuf.Element.

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
        set_element(delta.new_element)

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
    def chart_method(self, data, **kwargs):
        return self._native_chart(Chart(data, type=chart_type, **kwargs))

    setattr(DeltaGenerator, chart_type, chart_method)


# Add chart-building methods to DeltaGenerator
for chart_type in CHART_TYPES:
    _register_native_chart_method(to_snake_case(chart_type))
