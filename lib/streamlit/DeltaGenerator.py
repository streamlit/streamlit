# -*- coding: future_fstrings -*-
"""Allows us to create and absorb changes (aka Deltas) to elements."""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import io
import json
import math
import numpy as np
import pandas as pd
import random
import sys
import textwrap
import traceback

from streamlit import data_frame_proto
from streamlit import image_proto
from streamlit import protobuf
from streamlit.Chart import Chart
from streamlit.VegaLiteChart import VegaLiteChart, transform_dataframe, VEGA_LITE_BUILDERS
from streamlit.caseconverters import to_snake_case
from streamlit.chartconfig import CHART_TYPES
from streamlit.logger import get_logger

MAX_DELTA_BYTES = 14 * 1024 * 1024 # 14MB
EXPORT_TO_IO_FLAG = '__export_to_io__'

# setup logging
from streamlit.logger import get_logger
LOGGER = get_logger()

from functools import wraps

def _export_to_io(method):
    """Flag this DeltaGenerator method to be exported to the streamlit
    package.

    This should be the outermost decorator, i.e. before all others.
    """
    setattr(method, EXPORT_TO_IO_FLAG, True)
    return method

def _create_element(method):
    """Allows you to easily create a method which creates a new element delta.

    Converts a method of the with arguments (self, element, ...) into a method
    with arguments (self, ...). Thus, the intantiation of the element proto
    object and creation of the element are handled automaticallyself.

    Args
    ----
    method: A DeltaGenerator method with arguments (self, element, ...)

    Returns
    -------
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

class _VegaLite(object):
    """An empty class to hold Vega Lite objects."""
    pass

class DeltaGenerator(object):
    """
    Creates delta messages. If id is set to none, then an id is created for each
    message and a new Generator with that id is created."
    """

    def __init__(self, queue, id=None):
        """
        Constructor.

        queue - callback when delta is generated
        id    - id for deltas, or None to create a new generator each time
        """
        self._queue = queue
        if id == None:
            self._generate_new_ids = True
            self._next_id = 0
        else:
            self._generate_new_ids = False
            self._id = id

    @_export_to_io
    @_create_element
    def balloons(self, element):
        """Draws celebratory balloons!
        """
        element.balloons.type = protobuf.Balloons.DEFAULT
        element.balloons.execution_id = random.randrange(0xFFFFFFFF)

    @_export_to_io
    @_create_element
    def text(self, element, body):
        """Writes fixed width text.

        Args
        ----
        body : string
            The string to display.
        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.PLAIN

    @_export_to_io
    @_create_element
    def markdown(self, element, body):
        """Displays the string, formatted as markdown.

        Args
        ----
        string : string
            The string to display as markdown.

        Returns
        -------
        A DeltaGenerator object which allows you to overwrite this element.
        """
        element.text.body = textwrap.dedent(body).strip()
        element.text.format = protobuf.Text.MARKDOWN

    @_export_to_io
    @_create_element
    def json(self, element, body):
        """Displays the object as a pretty JSON string.

        Args
        ----
        object : object
            The object to stringify. All referenced objects should have JSON counterpart.
            If object is a string, we assume it is already JSON formatted.
        """
        element.text.body = (body if isinstance(body, string_types) else json.dumps(body))
        element.text.format = protobuf.Text.JSON

    @_export_to_io
    @_create_element
    def title(self, element, string):
        """Displays the string as a title (h1) header.

        Args
        ----
        string : string
            The string to display.

        Returns
        -------
        A DeltaGenerator object which allows you to overwrite this element.
        """
        element.text.body = str(string)
        element.text.format = protobuf.Text.TITLE

    @_export_to_io
    @_create_element
    def header(self, element, string):
        """Displays the string as a h2 header.

        Args
        ----
        string : string
            The string to display.

        Returns
        -------
        A DeltaGenerator object which allows you to overwrite this element.
        """
        element.text.body = str(string)
        element.text.format = protobuf.Text.HEADER

    @_export_to_io
    @_create_element
    def subheader(self, element, string):
        """Displays the string as a h3 header.

        Args
        ----
        string : string
            The string to display.

        Returns
        -------
        A DeltaGenerator object which allows you to overwrite this element.
        """
        element.text.body = str(string)
        element.text.format = protobuf.Text.SUB_HEADER

    @_export_to_io
    @_create_element
    def error(self, element, body):
        """
        Creates an element with showing an error string.

        Args
        ----
        body: str
            The text to display. Can include newlines.
        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.ERROR

    @_export_to_io
    @_create_element
    def warning(self, element, body):
        """
        Creates an element with showing an warning string.

        Args
        ----
        body: str
            The text to display. Can include newlines.
        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.WARNING

    @_export_to_io
    @_create_element
    def info(self, element, body):
        """
        Creates an element with showing an info string.

        Args
        ----
        body: str
            The text to display. Can include newlines.
        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.INFO

    @_export_to_io
    @_create_element
    def success(self, element, body):
        """
        Creates an element with showing an success string.

        Args
        ----
        body: str
            The text to display. Can include newlines.
        """
        element.text.body = str(body)
        element.text.format = protobuf.Text.SUCCESS

    @_export_to_io
    def link(self, *args, **kwargs):
        """
        Creates an element showing a link

        Args
        ----
        body: str
            The link.
        """
        raise RuntimeError('Link() is deprecated. Please use markdown() instead.')

    @_export_to_io
    @_create_element
    def help(self, element, obj):
        """Displays the doc string for this object, nicely formatted.

        Displays the doc string for this object. If the doc string is
        represented as ReStructuredText, then it will be converted to
        Markdown on the client before display.

        Args
        ----
        obj: Object
            The object to display.

        Returns
        -------
        A DeltaGenerator object which allows you to overwrite this element.

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
        if not isinstance(doc_string, string_types):
            doc_string = f'No docs available.'
        element.doc_string.doc_string = textwrap.dedent(doc_string).strip()

    @_export_to_io
    @_create_element
    def exception(self, element, exception, exception_traceback=None):
        """
        Prints this exception to the Report.

        Args
        ----
        exception: Exception
            The exception to display.
        exception_traceback: Exception Traceback or None
            Set to non-None to force the display of this traceback. Otherwise,
            the traceback will be figure out implicitly.
        """
        element.exception.type = type(exception).__name__
        element.exception.message = str(exception)

        # Get and extract the traceback for the exception.
        if exception_traceback != None:
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
        if extracted_traceback == None:
            stack_trace = [
                'Cannot extract the stack trace for this exception. '\
                'Try calling exception() within the `catch` block.']
        else:
            stack_trace = traceback.format_list(extracted_traceback)
        element.exception.stack_trace.extend(stack_trace)

    @_export_to_io
    def dataframe(self, pandas_df):
        """
        Renders a dataframe to the client.

        pandas_df - The dataframe.
        """
        if type(pandas_df) != pd.DataFrame:
            pandas_df = pd.DataFrame(pandas_df)
        def set_data_frame(element):
            data_frame_proto.marshall_data_frame(pandas_df, element.data_frame)
        return self._new_element(set_data_frame)

    def _native_chart(self, chart):
        """Displays a chart.
        """
        def set_chart(element):
            chart.marshall(element.chart)
        return self._new_element(set_chart)

    @_export_to_io
    @_create_element
    def vega_lite_chart(self, element, data=None, spec=None, **kwargs):
        """Displays a chart.
        """
        vc = VegaLiteChart(data, spec, **kwargs)
        vc.marshall(element.vega_lite_chart)

    @_export_to_io
    @_create_element
    def pyplot(self, element, fig=None):
        """Displays a matplotlib.pyplot image.

        Args
        ----
        fig : Matplotlib Figure
            The figure to plot. When this argument isn't specified, which is
            the usual case, this function will render the global plot.
        """
        try:
            import matplotlib
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

    @_export_to_io
    @_create_element
    def image(self, element, image, caption=None, width=None,
            use_column_width=False, clamp=False):
        """Displays an image.

        Args
        ----
        image : image or array of images
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
            OR an RGBA image of shape (w,h,4)
            OR a list of one of the above
        caption : string or list of strings
            String caption
        width : int or None
            Image width. 'None' means use the image width.
        use_column_width : bool
            If True, set the image width to the column width. This overrides
            the `width` parameter.
        clamp : bool
            Clamp the image to the given range.
        """
        if use_column_width:
            width = -2
        elif width == None:
            width = -1
        elif width <= 0:
            raise RuntimeError('Image width must be positive.')
        image_proto.marshall_images(image, caption, width, element.imgs, clamp)

    # TODO: remove `img()`, now replaced by `image()`
    @_export_to_io
    def img(self, *args, **kwargs):
        """DEPRECATED. Use st.image() instead."""
        raise RuntimeError('DEPRECATED. Please use image() instead.')

    @_export_to_io
    @_create_element
    def progress(self, element, value):
        """Displays the string as a h3 header.

        Args
        ----
        value : int
            The percentage complete: 0 <= value <= 100

        Returns
        -------
        A DeltaGenerator object which allows you to overwrite this element.

        Examples
        --------
        Here is an example of a progress bar increasing over time::
            import time
            my_bar = st.progress(0)
            for percent_complete in range(100):
                my_bar.progress(percent_complete + 1)
        """
        element.progress.value = value

    @_export_to_io
    @_create_element
    def empty(self, element):
        """Adds an element that will not be rendered.
        """
        # NOTE: protobuf needs something to be set
        element.empty.unused = True

    @_export_to_io
    @_create_element
    def map(self, element, points):
        """Creates a map element.

        Args
        ----
        points : DataFrame
            The points to display. Must have 'lat' and 'lon' columns.
        """
        LAT_LON = ['lat', 'lon']
        assert set(points.columns) >= set(LAT_LON), \
            'Map points must contain "lat" and "lon" columns.'
        data_frame_proto.marshall_data_frame(points[LAT_LON],
            element.map.points)

    @_export_to_io
    @_create_element
    def table(self, element, df):
        """Creates a map element.

        Args
        ----
        df : DataFrame
            The table data.
        """
        if type(df) != pd.DataFrame:
            df = pd.DataFrame(df)
        data_frame_proto.marshall_data_frame(df, element.table)

    def add_rows(self, df):
        assert not self._generate_new_ids, \
            'Only existing elements can add_rows.'
        if type(df) != pd.DataFrame:
            df = pd.DataFrame(df)

        df = self._maybe_transform_dataframe(df)

        delta = protobuf.Delta()
        delta.id = self._id
        data_frame_proto.marshall_data_frame(df, delta.add_rows)
        self._queue(delta)
        return self

    def _new_element(self, set_element):
        """
        Creates a new element delta, sets its value with set_element,
        sends the new element to the delta queue, and finally
        returns a generator for that element ID.

        set_element - Function which sets the fields for a protobuf.Element
        """
        # Create a delta message.
        delta = protobuf.Delta()
        set_element(delta.new_element)

        # # Make sure that the element isn't too big.
        # if len(delta.new_element.SerializeToString()) > MAX_DELTA_BYTES:
        #     alert_msg = 'Cannot transmit element larger than %s MB.' % \
        #         (MAX_DELTA_BYTES // (1024 ** 2))
        #     return self.error(alert_msg)

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

    def _maybe_transform_dataframe(self, df):
        # TODO(tvst): what is up with this _latest_element thing? ~ Adrien
        try:
            element_type = self._latest_element.WhichOneof('type')
            if element_type == 'vega_lite_chart':
                return transform_dataframe(
                    df, self._latest_element.vega_lite_chart.data_transform)
        except AttributeError:
            pass
        return df

    vega_lite = _VegaLite()


def createNewDelta():
    """Creates a new DeltaGenerator and sets up some basic info."""
    delta = protobuf.Delta()
    return delta

def register_vega_lite_chart_method(chart_type, chart_builder):
    """Adds a chart-building method to DeltaGenerator for a specific chart type.

    Args:
        chart_type -- A string with the snake-case name of the chart type to
        add. This will be the method name.

        chart_builder -- A function that returns an object that can marshall
        chart protos.
    """
    @_export_to_io
    @_create_element
    def vega_lite_chart_method(self, element, data=None, *args, **kwargs):
        vc = chart_builder(data, *args, **kwargs)
        vc.marshall(element.vega_lite_chart)

    setattr(DeltaGenerator.vega_lite, chart_type, vega_lite_chart_method)

# Add chart-building methods to DeltaGenerator
for k, v in VEGA_LITE_BUILDERS:
    register_vega_lite_chart_method(k, v)


def register_native_chart_method(chart_type):
    """Adds a chart-building method to DeltaGenerator for a specific chart type.

    Args:
        chart_type -- A string with the snake-case name of the chart type to
        add.
    """
    @_export_to_io
    def chart_method(self, data, **kwargs):
        return self._native_chart(Chart(data, type=chart_type, **kwargs))

    setattr(DeltaGenerator, chart_type, chart_method)

# Add chart-building methods to DeltaGenerator
for chart_type in CHART_TYPES:
    register_native_chart_method(to_snake_case(chart_type))
