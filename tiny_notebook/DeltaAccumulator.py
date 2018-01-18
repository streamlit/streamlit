"""
Provides DeltaAccumulator, a data structure for storing a bunch of deltas.
Whenever possible, deltas are combined.
"""

class DeltaAccumulator:
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
        self._deltas[index] = self.compose(self._deltas[index], delta)

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

    @staticmethod
    def compose(delta1, delta2):
        """Combines the two given deltas into one."""
        if (delta1 == None):
            return delta2

        print('delta1')
        print(delta1)
        print('delta2')
        print(delta2)
        raise RuntimeError('Need to implement the compose code.')
