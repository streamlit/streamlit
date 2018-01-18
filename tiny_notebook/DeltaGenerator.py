"""Allows us to create and absorb changes (aka Deltas) to elements."""

from tiny_notebook import protobuf, data_frame_io

class DeltaGenerator:
    """
    Creates delta messages. If id is set to none, then an id is created for each
    message and a new Generator with that id is created."
    """

    def __init__(self, accumulator, id=None):
        """
        Constructor.

        accumulator - callback when delta is generated
        id          - id for deltas, or None to create a new generator each time
        """
        self._accumulator = accumulator
        if id == None:
            self._generate_new_ids = True
            self._next_id = 0
        else:
            self._generate_new_ids = False
            self._id = id

    def text(self, text, classes='fixed-width'):
        div = protobuf.Div()
        div.text = text
        div.classes = classes

        element = protobuf.Element()
        element.div.CopyFrom(div)

        return self._new_element(element)

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

    def dataFrame(self, pandas_df):
        """
        Renders a dataframe to the client.

        pandas_df - The dataframe.
        """
        # Convert the pd.DataFrame into a protobuf.DataFrame.
        element = protobuf.Element()
        data_frame_io.marshall_data_frame(pandas_df, element.data_frame)

        # Create a NewElement delta with this DataFrame element.
        return self._new_element(element)

    def _new_element(self, element):
        """Creates a new element delta, calls the accumulator, and returns the
        generator."""
        # Figure out if we need to create a new ID for this element.
        if self._generate_new_ids:
            id = self._next_id
            generator = DeltaGenerator(self._accumulator, id)
            self._next_id += 1
        else:
            id = self._id
            generator = self

        # Create a delta message.
        new_element_delta = protobuf.Delta()
        new_element_delta.id = id
        new_element_delta.new_element.CopyFrom(element)

        # Call the accumulator and return the new element.
        self._accumulator(new_element_delta)
        return generator
