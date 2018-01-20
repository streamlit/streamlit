"""Allows us to create and absorb changes (aka Deltas) to elements."""

import pandas as pd
from tiny_notebook import protobuf, data_frame_proto

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

    def text(self, text, classes='fixed-width'):
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

    def header(self, text, level=1):
        """
        Creates a header element.

        text  - The text to display. Can include newlines.
        level - 1 (largest text) through 6 (smallest text)
        """
        assert 1 <= level <= 6, 'Level must be between 1 and 6.'
        return self.text(text, classes=f'h{level}')

    def data_frame(self, pandas_df):
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
        """
        Implements this chart.
        """
        def set_chart(element):
            chart.marshall(element.chart)
        return self._new_element(set_chart)

    def _new_element(self, set_element):
        """
        Creates a new element delta, sets its value with set_element,
        sends the new element to the delta queue, and finally
        returns a generator for that element ID.

        set_element - Function which sets the feilds for a protobuf.Element
        """
        # Figure out if we need to create a new ID for this element.
        if self._generate_new_ids:
            id = self._next_id
            generator = DeltaGenerator(self._queue, id)
            self._next_id += 1
        else:
            id = self._id
            generator = self

        # Create a delta message.
        delta = protobuf.Delta()
        delta.id = id
        set_element(delta.new_element)

        # Call the queue and return the new element.
        self._queue(delta)
        return generator
