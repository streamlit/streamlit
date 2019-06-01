# Copyright 2018 Streamlit Inc. All rights reserved.

"""
A queue of ForwardMsg associated with a particular report.
Whenever possible, message deltas are combined.
"""

import collections
import copy
import threading

from streamlit import protobuf
from streamlit import util

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


class ReportQueue(object):
    """Thread-safe queue that smartly accumulates the report's messages."""

    def __init__(self):
        """Constructor."""
        self._lock = threading.Lock()

        with self._lock:
            self._queue = []

            # Map of msg.delta.id to the msg's index in _queue.
            self._delta_id_map = dict()

    def get_debug(self):
        return {
            'queue': [util.forwardmsg_to_debug(m) for m in self._queue],
            'ids': list(self._delta_id_map.keys()),
        }

    def __iter__(self):
        return iter(self._queue)

    def is_empty(self):
        return len(self._queue) == 0

    def get_initial_msg(self):
        if len(self._queue) > 0:
            return self._queue[0]
        return None

    def enqueue(self, msg):
        """Add message into queue, possibly composing it with another message.

        Parameters
        ----------
        msg : protobuf.ForwardMsg
        """
        with self._lock:
            if not msg.HasField('delta'):
                self._queue.append(msg)

            elif msg.delta.id in self._delta_id_map:
                # Combine the previous message into the new messages.
                index = self._delta_id_map[msg.delta.id]
                old_msg = self._queue[index]
                composed_delta = compose_deltas(old_msg.delta, msg.delta)
                new_msg = protobuf.ForwardMsg()
                new_msg.delta.CopyFrom(composed_delta)
                self._queue[index] = new_msg

            else:
                self._delta_id_map[msg.delta.id] = len(self._queue)
                self._queue.append(msg)

    def clone(self):
        """Return the elements of this ReportQueue as a collections.deque."""
        r = ReportQueue()

        with self._lock:
            r._queue = list(self._queue)
            r._delta_id_map = dict(self._delta_id_map)

        return r

    def _clear(self):
        self._queue = []
        self._delta_id_map = dict()

    def clear(self):
        """Clear this queue."""
        with self._lock:
            self._clear()

    def flush(self):
        with self._lock:
            queue = self._queue
            self._clear()
        return queue


def compose_deltas(old_delta, new_delta):
    """Combines new_delta onto old_delta if possible.

    If combination takes place, returns old_delta, since it has the combined
    data. If not, returns new_delta.

    """
    new_delta_type = new_delta.WhichOneof('type')

    if new_delta_type == 'new_element':
        return new_delta

    elif new_delta_type == 'add_rows':
        import streamlit.elements.data_frame_proto as data_frame_proto
        # We should make data_frame_proto.add_rows *not* mutate any of the
        # inputs. In the meantime, we have to deepcopy the input that will be
        # mutated.
        composed_delta = copy.deepcopy(old_delta)
        data_frame_proto.add_rows(
            composed_delta, new_delta, name=new_delta.add_rows.name)
        return composed_delta

    LOGGER.error('Old delta: %s;\nNew delta: %s;', old_delta, new_delta)

    raise NotImplementedError('Need to implement the compose code.')
