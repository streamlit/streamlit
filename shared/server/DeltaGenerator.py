"""Allows us to create and absorb changes (aka Deltas) to elements."""

import pandas as pd
import numpy as np
import json
import textwrap

from streamlit.shared import image_proto
from streamlit.local.Chart import Chart
from streamlit.local.chartconfig import CHART_TYPES
from streamlit.local.caseconverters import to_snake_case
from streamlit.shared import data_frame_proto
from streamlit.shared import protobuf

MAX_DELTA_BYTES = 14 * 1024 * 1024 # 14MB

# Dispatch based on the 'fmt' argument.
SUPPORTED_FORMATS = [
    'alert',
    'chart',
    'dataframe',
    'header',
    'img',
    'json',
    'markdown',
    'progress',
    'text',
]

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
        def create_element(element):
            method(self, element, *args, **kwargs)
        return self._new_element(create_element)
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
        element.text.body = string
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
        element.text.body = string
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
        element.text.body = string
        element.text.format = protobuf.Text.SUB_HEADER

    @_export_to_io
    def text(self, text, classes='fixed-width'):
        """Writes fixed width text to the console."""
        text = str(text)
        def set_text(element):
            element.div.text = text
            element.div.classes = classes
        return self._new_element(set_text)

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
        element.doc_string.name = obj.__name__
        try:
            element.doc_string.module = obj.__module__
        except AttributeError:
            pass
        element.doc_string.doc_string = obj.__doc__

    @_export_to_io
    def alert(self, text, type='danger'):
        """
        Creates an alert element.

        text - The text to display. Can include newlines.
        type - 'success' | 'info' | 'warning' | 'danger' (default)
        """
        ALLOWED_TYPES = ['success', 'info', 'warning', 'danger']
        assert type in ALLOWED_TYPES, \
            f'Alert type must be one of {{{", ".join(ALLOWED_TYPES)}}}.'
        return self.text(text, classes=f'alert alert-{type}')

    # @_export_to_io
    # def header(self, text, level=3):
    #     """
    #     Creates a header element.
    #
    #     text  - The text to display. Can include newlines.
    #     level - 1 (largest text) through 6 (smallest text)
    #     """
    #     assert 1 <= level <= 6, 'Level must be between 1 and 6.'
    #     return self.text(text, classes=f'h{level}')

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
    def progress(self, value):
        """Diplay a progress bar.

        value - Should be between 0 and 100
        """
        def set_progress(element):
            element.progress.value = value
        return self._new_element(set_progress)

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
    def json(self, body):
        """Write JSON.

        body - either a JSON object or a string
        """
        def set_body(element):
            element.text.body = (body if isinstance(body, str) else json.dumps(body))
            element.text.format = protobuf.Text.JSON
        return self._new_element(set_body)

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

        # Make sure that the element isn't too big.
        if len(delta.new_element.SerializeToString()) > MAX_DELTA_BYTES:
            alert_msg = 'Cannot transmit element larger than %s MB.' % \
                (MAX_DELTA_BYTES // (1024 ** 2))
            return self.alert(alert_msg)

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
