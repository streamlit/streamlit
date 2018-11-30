# -*- coding: future_fstrings -*-

# Copyright 2018 Streamlit Inc. All rights reserved.

"""
A queue of deltas associated with a particular Report.
Whenever possible, deltas are combined.
"""

# Python 2/3 compatibility
from __future__ import print_function, division, unicode_literals, absolute_import
from streamlit.compatibility import setup_2_3_shims
setup_2_3_shims(globals())

import copy
import enum

from streamlit import data_frame_proto
from streamlit import protobuf
from tornado import gen

from streamlit.logger import get_logger
LOGGER = get_logger(__name__)


# Largest message that can be sent via the WebSocket connection.
# (Limit was picked by trial and error)
# TODO: Break message in several chunks if too large.
MESSAGE_SIZE_LIMIT = 10466493


class QueueState(object):
    # Indicates that the queue is accepting deltas.
    OPEN = 0

    # Indicates that the queue will close on the nextz flush.
    CLOSING = 1

    # Indicates that the queue is now closed.
    CLOSED = 2


class ReportQueue(object):
    """Accumulates a bunch of deltas."""

    def __init__(self):
        """Constructor."""
        self._state = QueueState.OPEN
        self._empty()

    def __call__(self, delta):
        """Adds a delta into this queue."""
        assert self._state != QueueState.CLOSED, \
            'Cannot add deltas after the queue closes.'

        if self._state == QueueState.CLOSING:
            LOGGER.debug('Warning: Enqueing a delta in a closing queue.')

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

    @gen.coroutine
    def flush_queue(self, ws):
        """Sends the deltas across the websocket in a series of delta messages,
        clearing the queue afterwards."""
        assert self._state != QueueState.CLOSED, \
            'Cannot get deltas after the queue closes.'

        # Send any remaining deltas.
        @gen.coroutine
        def send_deltas():
            deltas = self.get_deltas()
            for delta in deltas:
                msg = protobuf.ForwardMsg()
                msg.delta.CopyFrom(delta)
                yield send_message(ws, msg)
            raise gen.Return(len(deltas) > 0)
        yield send_deltas()

        # Send report_finished method if this queue is closed.
        if self._state == QueueState.CLOSING:
            # Keep flushing the deltas until the queue is empty
            while True:
                sent_more_deltas = yield send_deltas()
                LOGGER.debug('Sent a final set of deltas: %s' % sent_more_deltas)
                if not sent_more_deltas:
                    LOGGER.debug('No more deltas to send.')
                    break
            LOGGER.debug('This queue is closing.')
            self._state = QueueState.CLOSED
            msg = protobuf.ForwardMsg()
            msg.report_finished = True
            yield send_message(ws, msg)
            LOGGER.debug('Sent report_finished message.')

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
        self._id_map = dict() # use insead of {} for 2/3 compatibility

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

        raise NotImplementedError('Need to implement the compose code.')


def send_message(ws, msg):
    """Sends msg via the websocket.

    Parameters
    ----------
    ws : WebSocket
        The message through which we're sending this message.
    msg : ForwardMsg
        A Streamlit ForwardMsg to send over the websocket.

    """
    msg_str = msg.SerializeToString()

    if len(msg_str) > MESSAGE_SIZE_LIMIT:
        send_exception(ws, msg, 'RuntimeError', 'Data too large')
        return

    try:
        ws.write_message(msg_str, binary=True)
    except Exception as e:
        # Not all exceptions have a `message` attribute.
        # https://www.python.org/dev/peps/pep-0352/
        try:
            exception_message = e.message
        except AttributeError:
            exception_message = str(e)
        send_exception(ws, msg, type(e), exception_message)


def send_exception(ws, msg, exception_type, exception_message):
    """Sends an exception via websocket in place of msg"""
    if msg.delta is not None:
        delta_id = msg.delta.id
    else:
        delta_id = 0

    emsg = protobuf.ForwardMsg()
    emsg.delta.id = delta_id
    emsg.delta.new_element.exception.type = str(exception_type)
    emsg.delta.new_element.exception.message = exception_message

    ws.write_message(emsg.SerializeToString(), binary=True)
