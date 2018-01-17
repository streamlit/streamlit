"""Allows us to create and absorb changes (aka Deltas) to elements."""

from tiny_notebook import protobuf

class Generator:
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

    def text(self, text, classes=''):
        div = protobuf.DivElement()
        div.text = text
        div.classes = classes

        element = protobuf.Element()
        element.div.CopyFrom(div)

        self._new_element(element)

    def _new_element(self, element):
        """Creates a new element delta, calls the accumulator, and returns the
        generator."""
        # Figure out if we need to create a new ID for this element.
        if self._generate_new_ids:
            id = self._next_id
            generator = Generator(self._accumulator, id)
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

class Accumulator:
    """Accumulates a bunch of deltas."""

    def __init__(self):
        """Constructor."""
        self._empty()

    def add_delta(self, delta):
        """Accumulates this delta into the list."""
        # Store the index if necessary.
        if (delta.id in self._id_map):
            index = self._id_map(delta.id)
        else:
            index = len(self._deltas)
            self._id_map[delta.id] = index
            self._deltas.append(None)

        # Combine the previous and new delta.
        self._deltas[index] = compose(self._deltas[index], delta)

        print('Finished adding deltas.')
        print(self._id_map)
        print(self._deltas)

    def get_deltas(self):
        """Returns a list of deltas in a DeltaList message
        and clears this accumulator."""
        deltas = self._deltas
        self._empty()
        return deltas

    def _empty(self):
        """Returns this Accumulator to an empty state."""
        self._deltas = []
        self._id_map = {}

def compose(delta1, delta2):
    """Combines the two given deltas into one."""
    if (delta1 == None):
        return delta2

    print('delta1')
    print(delta1)
    print('delta2')
    print(delta2)
    raise RuntimeError('Need to implement the compose code.')
