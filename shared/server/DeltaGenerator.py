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

DATAFRAME_LIKE_TYPES = (
    pd.DataFrame,
    pd.Series,
    pd.Index,
    np.ndarray,
)

FIGURE_LIKE_TYPES = (
    Chart,
)

class DeltaGenerator:
    """
    Creates delta messages. If id is set to none, then an id is created for each
    message and a new Generator with that id is created."
    """

    def __init__(self, queue, id=None):
        """
        Constructor.

        queue - callback when delta is generated
        id          - id for deltas, or None to create a new generator each time
        """
        self._queue = queue
        if id == None:
            self._generate_new_ids = True
            self._next_id = 0
        else:
            self._generate_new_ids = False
            self._id = id

    def __call__(self, *args, fmt='autp', **kwargs):
        """Writes it's arguments to notebook pages.

        with Notebook() as print:
            print('A Test', fmt='header')
            print('Hello world.')
            print('This is an alert', fmt='alert')
            print('This is a dataframe', pd.DataFrame([1, 2, 3]))

        This also works:

        with Notebook() as print:
            print.header('A Test')
            print('Hello world.')
            print.alert('This is an alert')
            print('This is a dataframe')
            print.dataframe(pd.DataFrame([1, 2, 3]))

        Supported types are:

            - streamlit.Charts
            - Pandas-DataFrame-like objects: DataFame, Series, and numpy.Array
            - String-like objects: By default, objects are cast to strings.

        The optional `fmt` argument can take on several values:

            - "auto"     : figures out the format
            - "alert"    : formats the string as an alert
            - "header"   : formats the string as a header
            - "info"     : prints out df.info() on a DataFrame-like object
            - "img"      : prints an image out
            - "progress" : prints out a progress bar (for a 0<num<1)
            - "markdown" : prints out as Markdown-formatted text
            - "json" : prints out as JSON-formatted text
        """
        if fmt in SUPPORTED_FORMATS:
            assert len(args) == 1, f'Format "{fmt}" requires only one argument.'
            return getattr(self, fmt)(args[0], **kwargs)

        # Otherwise, dispatch based on type.

        string_buffer = []
        def flush_buffer():
            if string_buffer:
                self.text(' '.join(string_buffer))
                string_buffer[:] = []

        for arg in args:
            if isinstance(arg, DATAFRAME_LIKE_TYPES):
                flush_buffer()
                self.dataframe(arg)
            elif isinstance(arg, FIGURE_LIKE_TYPES):
                flush_buffer()
                self.chart(arg)
            else:
                string_buffer.append(str(arg))

        flush_buffer()

    def text(self, text, classes='fixed-width'):
        text = str(text)
        def set_text(element):
            element.div.text = text
            element.div.classes = classes
        return self._new_element(set_text)

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

    def header(self, text, level=3):
        """
        Creates a header element.

        text  - The text to display. Can include newlines.
        level - 1 (largest text) through 6 (smallest text)
        """
        assert 1 <= level <= 6, 'Level must be between 1 and 6.'
        return self.text(text, classes=f'h{level}')

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

    def chart(self, chart):
        """Displays a chart.
        """
        def set_chart(element):
            chart.marshall(element.chart)
        return self._new_element(set_chart)

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

    def progress(self, value):
        """Diplay a progress bar.

        value - Should be between 0 and 100
        """
        def set_progress(element):
            element.progress.value = value
        return self._new_element(set_progress)

    def markdown(self, body):
        """Diplay Markdown-formatted text.

        body - Plain text of Markdown format
        """
        def set_body(element):
            element.text.body = textwrap.dedent(body).strip()
            element.text.format = protobuf.Text.MARKDOWN
        return self._new_element(set_body)

    def json(self, body):
        """Diplay Markdown-formatted text.

        body - Plain text of Markdown format
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
    def chart_method(self, data, **kwargs):
        return self.chart(Chart(data, type=chart_type, **kwargs))

    setattr(DeltaGenerator, chart_type, chart_method)

# Add chart-building methods to DeltaGenerator
for chart_type in CHART_TYPES:
    register_chart_method(to_snake_case(chart_type))
