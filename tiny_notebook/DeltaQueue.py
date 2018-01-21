
"""
Provides DeltaQueue, a data structure for storing a bunch of deltas.
Whenever possible, deltas are combined.
"""

class DeltaQueue:
    """Accumulates a bunch of deltas."""

    def __init__(self):
        """Constructor."""
        self._empty()

    def add_delta(self, delta):
        """Accumulates this delta into the list."""
        # # debug - begin
        # try:
        #     delta.new_element.div.text.lower().index('iteration')
        #     got_fancy_delta = True
        #     # print('GOT THIS BIG DELTA')
        #     # print(delta)
        #     # raise RuntimeError('Got this big delta.')
        # except ValueError:
        #     pass
        # except Exception as e:
        #     print('GOT EXCPETION:', e)
        # # debug - end

        # Store the index if necessary.
        if (delta.id in self._id_map):
            index = self._id_map[delta.id]
        else:
            index = len(self._deltas)
            self._id_map[delta.id] = index
            self._deltas.append(None)

        # # debug - begin
        # if got_fancy_delta:
        #     print('GOT FANCY DELTA')
        #     print(delta)
        #     print(self._deltas)
        # # debug - end

        # debug - begin
        print(f'About to enqueue {delta.id}.')
        print(self._id_map)
        print([type(delta) for delta in self._deltas])
        # debug - end

        # Combine the previous and new delta.
        self._deltas[index] = self.compose(self._deltas[index], delta)

        # debug - begin
        print(f'Just enqueued {delta.id}.')
        print(self._id_map)
        print([type(delta) for delta in self._deltas])
        # debug - end

        # # debug - begin
        # if got_fancy_delta:
        #     print('APPLIED  FANCY DELTA')
        #     print(delta)
        #     print(self._deltas)
        # # debug - end

    def get_deltas(self):
        """Returns a list of deltas in a DeltaList message
        and clears this queue."""

        # debug - begin
        print('Clearing out the deltas:')
        print([type(delta) for delta in self._deltas])
        # debug - end

        deltas = self._deltas
        self._empty()

        # debug - begin
        print('Just cleared out the deltas:')
        print([type(delta) for delta in self._deltas])
        # debug - end

        return deltas

    def _empty(self):
        """Returns this Accumulator to an empty state."""
        self._deltas = []
        self._id_map = {}

    @staticmethod
    def compose(delta1, delta2):
        """Combines the two given deltas into one."""
        if delta1 == None:
            return delta2
        elif delta2.WhichOneof('type') == 'new_element':
            return delta2

        print('delta1')
        print(delta1)
        print('delta2')
        print(delta2)
        raise RuntimeError('Need to implement the compose code.')
