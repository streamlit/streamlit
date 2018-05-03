
"""
A queue of deltas associated with a particular Report.
Whenever possible, deltas are combined.
"""

import copy

from streamlit.shared import data_frame_proto
from streamlit.shared import protobuf

class ReportQueue:
    """Accumulates a bunch of deltas."""

    # Indicates that the queue is accepting deltas.
    STATE_OPEN = 0

    # Indicates that the queue will close on the nextz flush.
    STATE_CLOSING = 1

    # Indicates that the queue is now closed.
    STATE_CLOSED = 2

    def __init__(self):
        """Constructor."""
        self._empty()
        self._state = ReportQueue.STATE_OPEN

    def __call__(self, delta):
        """Adds a delta into this queue."""
        assert self._state != ReportQueue.STATE_CLOSED, \
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
        assert self._state != ReportQueue.STATE_CLOSED, \
            'Cannot get deltas after the queue closes.'

        deltas = self._deltas
        self._empty()

        return deltas

    async def flush_queue(self, ws):
        """Sends the deltas across the websocket in a DeltaList, clearing the
        queue afterwards."""
        assert self._state != ReportQueue.STATE_CLOSED, \
            'Cannot get deltas after the queue closes.'

        # Send any remaining deltas.
        deltas = self.get_deltas()
        if deltas:
            msg = protobuf.StreamlitMsg()
            msg.delta_list.deltas.extend(deltas)
            await ws.send_bytes(msg.SerializeToString())

        # Send report_finished method if this queue is closed.
        if self._state == ReportQueue.STATE_CLOSING:
            self._state = ReportQueue.STATE_CLOSED
            msg = protobuf.StreamlitMsg()
            msg.report_finished = True
            await ws.send_bytes(msg.SerializeToString())

    def clone(self):
        """Returns a clone of this ReportQueue."""
        assert self._state != ReportQueue.STATE_CLOSED, \
            'Cannot clone a closed queue.'
        return copy.deepcopy(self)

    def close():
        """Tells the queue to close and send a report_finished message after the
        next flush_queue call and send."""
        assert self._state != ReportQueue.STATE_CLOSED, \
            'Cannot re-close a queue.'
        self._state = ReportQueue.CLOSING

    def _empty(self):
        """Returns this Accumulator to an empty state."""
        assert self._state != ReportQueue.STATE_CLOSED, \
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
