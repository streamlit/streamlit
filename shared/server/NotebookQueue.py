
"""
A queue of deltas associated with a particular Notebook.
Whenever possible, deltas are combined.
"""

import copy

from streamlit.shared import data_frame_proto
from streamlit.shared import protobuf

class NotebookQueue:
    """Accumulates a bunch of deltas."""

    def __init__(self):
        """Constructor."""
        self._empty()

    def __call__(self, delta):
        """Adds a delta into this queue."""
        # Store the index if necessary.
        if (delta.id in self._id_map):
            index = self._id_map[delta.id]
        else:
            index = len(self._deltas)
            self._id_map[delta.id] = index
            self._deltas.append(None)

        # Combine the previous and new delta.
        self._deltas[index] = self.compose(self._deltas[index], delta)

    def get_deltas(self):
        """Returns a list of deltas and clears this queue."""
        deltas = self._deltas
        self._empty()

        return deltas

    async def flush_deltas(self, ws):
        """Sends the deltas across the websocket in a DeltaList, clearing the
        queue afterwards."""
        deltas = self.get_deltas()
        if deltas:
            msg = protobuf.StreamlitMsg()
            msg.delta_list.deltas.extend(deltas)
            await ws.send_bytes(msg.SerializeToString())

    def clone(self):
        """Returns a clone of this NotebookQueue."""
        return copy.deepcopy(self)

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
        elif delta2.WhichOneof('type') == 'add_rows':
            data_frame_proto.add_rows(delta1, delta2)
            return delta1

        print('delta1')
        print(delta1)
        print('delta2')
        print(delta2)
        raise NotImplementedError('Need to implement the compose code.')
