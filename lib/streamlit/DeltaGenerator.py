"""Allows us to create and absorb changes (aka Deltas) to elements."""

import json
import math
import numpy as np
import pandas as pd
import textwrap
import traceback

from streamlit import image_proto
from streamlit.Chart import Chart
from streamlit.chartconfig import CHART_TYPES
from streamlit.caseconverters import to_snake_case
from streamlit import data_frame_proto
from streamlit import protobuf

MAX_DELTA_BYTES = 14 * 1024 * 1024 # 14MB

EXPORT_TO_IO_FLAG = '__export_to_io__'

def _export_to_io(method):
    """Flag this DeltaGenerator method to be exported to the streamlit.io
    package.

    This should be the outermost decorator, i.e. before all others.
    """
    setattr(method, EXPORT_TO_IO_FLAG, True)
    return method

def _create_element(method):
    """Allows you to easily create a method which creates a new element deltaself.

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
    def wrapped_method(self, *args, **kwargs):
        try:
            def create_element(element):
                method(self, element, *args, **kwargs)
            return self._new_element(create_element)
        except Exception as e:
            self.exception(e)
    wrapped_method.__name__ = method.__name__
    wrapped_method.__doc__ = method.__doc__
    return wrapped_method

class DeltaGenerator:
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
        To learn how the io.write function works, call::
            io.help(io.write)
        """
        if not hasattr(obj, '__name__'):
            raise RuntimeError(f'help() expects module or method, not type `{type(obj).__name__}`')
        element.doc_string.name = obj.__name__
        try:
            element.doc_string.module = obj.__module__
        except AttributeError:
            pass
        doc_string = obj.__doc__
        if type(doc_string) is not str:
            doc_string = f'No docs available.'
        element.doc_string.doc_string = textwrap.dedent(doc_string).strip()

    @_export_to_io
    @_create_element
    def exception(self, element, exception):
        """
        Prints this exception to the Report.

        Args
        ----
        exception: Exception
            The exception to display.
        """
        tb = traceback.extract_tb(exception.__traceback__)
        element.exception.type = type(exception).__name__
        element.exception.message = str(exception)
        element.exception.stack_trace.extend(traceback.format_list(tb))

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

    @_export_to_io
    def chart(self, chart):
        """Displays a chart.
        """
        def set_chart(element):
            chart.marshall(element.chart)
        return self._new_element(set_chart)

    @_export_to_io
    @_create_element
    def image(self, element, image, caption=None, width=0):
        """Displays an image.

        Args
        ----
        image: image or array
            Monochrome image of shape (w,h) or (w,h,1)
            OR a color image of shape (w,h,3)
        caption:
            String caption
        width:
            Image width. 0 means use original width.
        """
        image_proto.marshall_images(image, caption, width, element.imgs)

    # TODO: remove `img()`, now replaced by `image()`
    @_export_to_io
    def img(self, imgs, caption=None, width=0):
        """Displays an image or horizontal array of images.

        imgs     - a monochrom image of shape (w,h) or (w,h,1)
                   OR a color image of shape (w,h,3)
                   OR an array of such images
        caption  - string caption, or string array for multiple images
        width    - Image width. 0 means use original width.
        """
        def set_images(element):
            image_proto.marshall_images(imgs, caption, width, element.imgs)
        return self._new_element(set_images)

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
            my_bar = io.progress(0)
            for percent_complete in range(100):
                my_bar.progress(percent_complete + 1)
        """
        element.progress.value = value

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
        element.text.body = (body if isinstance(body, str) else json.dumps(body))
        element.text.format = protobuf.Text.JSON

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
        No args for the tie being.
        """
        LAT_LON = ['lat', 'lon']
        assert set(points.columns) >= set(LAT_LON), \
            'Map points must contain "lat" and "lon" columns.'
        data_frame_proto.marshall_data_frame(points[LAT_LON],
            element.map.points)

    def add_rows(self, df):
        assert not self._generate_new_ids, \
            'Only existing elements can add_rows.'
        if type(df) != pd.DataFrame:
            df = pd.DataFrame(df)
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

        set_element - Function which sets the feilds for a protobuf.Element
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

def register_chart_method(chart_type):
    """Adds a chart-building method to DeltaGenerator for a specific chart type.

    Args:
        chart_type -- A string with the snake-case name of the chart type to
        add.
    """
    @_export_to_io
    def chart_method(self, data, **kwargs):
        return self.chart(Chart(data, type=chart_type, **kwargs))

    setattr(DeltaGenerator, chart_type, chart_method)

# Add chart-building methods to DeltaGenerator
for chart_type in CHART_TYPES:
    register_chart_method(to_snake_case(chart_type))
