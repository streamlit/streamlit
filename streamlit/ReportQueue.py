
"""
A queue of deltas associated with a particular Report.
Whenever possible, deltas are combined.
"""

import copy
import enum

from streamlit import data_frame_proto
from streamlit import protobuf

class QueueState(enum.Enum):
    # Indicates that the queue is accepting deltas.
    OPEN = 0

    # Indicates that the queue will close on the nextz flush.
    CLOSING = 1

    # Indicates that the queue is now closed.
    CLOSED = 2

class ReportQueue:
    """Accumulates a bunch of deltas."""

    def __init__(self):
        """Constructor."""
        self._state = QueueState.OPEN
        self._empty()

    def __call__(self, delta):
        """Adds a delta into this queue."""
        assert self._state != QueueState.CLOSED, \
            'Cannot add deltas after the queue closes.'

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
        assert self._state != QueueState.CLOSED, \
            'Cannot get deltas after the queue closes.'

        deltas = self._deltas
        self._empty()

        return deltas

    async def flush_queue(self, ws):
        """Sends the deltas across the websocket in a DeltaList, clearing the
        queue afterwards."""
        assert self._state != QueueState.CLOSED, \
            'Cannot get deltas after the queue closes.'

        # Send any remaining deltas.
        deltas = self.get_deltas()
        if deltas:
            msg = protobuf.StreamlitMsg()
            msg.delta_list.deltas.extend(deltas)
            await ws.send_bytes(msg.SerializeToString())

        # Send report_finished method if this queue is closed.
        if self._state == QueueState.CLOSING:
            self._state = QueueState.CLOSED
            msg = protobuf.StreamlitMsg()
            msg.report_finished = True
            await ws.send_bytes(msg.SerializeToString())

    def clone(self):
        """Returns a clone of this ReportQueue."""
        assert self._state != QueueState.CLOSED, \
            'Cannot clone a closed queue.'
        return copy.deepcopy(self)

    def close(self):
        """Tells the queue to close and send a report_finished message after the
        next flush_queue call and send."""
        assert self._state != QueueState.CLOSED, \
            'Cannot re-close a queue.'
        self._state = QueueState.CLOSING

    def is_closed(self):
        """Returns true if this queue has been closed."""
        return self._state == QueueState.CLOSED

    def _empty(self):
        """Returns this Accumulator to an empty state."""
        assert self._state != QueueState.CLOSED, \
            'Cannot empty a closed queue.'
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
