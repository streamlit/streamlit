# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

"""
A queue of ForwardMsg associated with a particular session.
Whenever possible, message deltas are combined.
"""

import threading
from typing import Optional, List, Dict, Any, Tuple, Iterator
import attr

from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

from streamlit.logger import get_logger

LOGGER = get_logger(__name__)


@attr.s(auto_attribs=True, slots=True)
class ForwardMsgQueue:
    """Thread-safe queue that smartly accumulates the session's messages."""

    _lock: threading.Lock = attr.Factory(threading.Lock)
    _queue: List[ForwardMsg] = attr.Factory(list)

    # A mapping of (delta_path -> _queue.indexof(msg)) for each
    # Delta message in the queue. We use this for coalescing
    # redundant outgoing Deltas (where a newer Delta supercedes
    # an older Delta, with the same delta_path, that's still in the
    # queue).
    _delta_index_map: Dict[Tuple[int, ...], int] = attr.Factory(dict)

    def get_debug(self) -> Dict[str, Any]:
        from google.protobuf.json_format import MessageToDict

        return {
            "queue": [MessageToDict(m) for m in self._queue],
            "ids": list(self._delta_index_map.keys()),
        }

    def __iter__(self) -> Iterator[ForwardMsg]:
        return iter(self._queue)

    def is_empty(self) -> bool:
        return len(self._queue) == 0

    def get_initial_msg(self) -> Optional[ForwardMsg]:
        if len(self._queue) > 0:
            return self._queue[0]
        return None

    def enqueue(self, msg: ForwardMsg) -> None:
        """Add message into queue, possibly composing it with another message."""
        with self._lock:
            if not _is_composable_message(msg):
                self._queue.append(msg)
                return

            # If there's a Delta message with the same delta_path already in
            # the queue - meaning that it refers to the same location in
            # the app - we attempt to combine this new Delta into the old
            # one. This is an optimization that prevents redundant Deltas
            # from being sent to the frontend.
            delta_key = tuple(msg.metadata.delta_path)
            if delta_key in self._delta_index_map:
                index = self._delta_index_map[delta_key]
                old_msg = self._queue[index]
                composed_delta = _maybe_compose_deltas(old_msg.delta, msg.delta)
                if composed_delta is not None:
                    new_msg = ForwardMsg()
                    new_msg.delta.CopyFrom(composed_delta)
                    new_msg.metadata.CopyFrom(msg.metadata)
                    self._queue[index] = new_msg
                    return

            # No composition occured. Append this message to the queue, and
            # store its index for potential future composition.
            self._delta_index_map[delta_key] = len(self._queue)
            self._queue.append(msg)

    def _clear(self) -> None:
        self._queue = []
        self._delta_index_map = dict()

    def clear(self) -> None:
        """Clear this queue."""
        with self._lock:
            self._clear()

    def flush(self) -> List[ForwardMsg]:
        with self._lock:
            queue = self._queue
            self._clear()
        return queue


def _is_composable_message(msg: ForwardMsg) -> bool:
    """True if the ForwardMsg is potentially composable with other ForwardMsgs."""
    if not msg.HasField("delta"):
        # Non-delta messages are never composable.
        return False

    # We never compose add_rows messages in Python, because the add_rows
    # operation can raise errors, and we don't have a good way of handling
    # those errors in the message queue.
    delta_type = msg.delta.WhichOneof("type")
    return delta_type != "add_rows" and delta_type != "arrow_add_rows"


def _maybe_compose_deltas(old_delta: Delta, new_delta: Delta) -> Optional[Delta]:
    """Combines new_delta onto old_delta if possible.

    If the combination takes place, the function returns a new Delta that
    should replace old_delta in the queue.

    If the new_delta is incompatible with old_delta, the function returns None.
    In this case, the new_delta should just be appended to the queue as normal.
    """
    old_delta_type = old_delta.WhichOneof("type")
    if old_delta_type == "add_block":
        # We never replace add_block deltas, because blocks can have
        # other dependent deltas later in the queue. For example:
        #
        #   placeholder = st.empty()
        #   placeholder.columns(1)
        #   placeholder.empty()
        #
        # The call to "placeholder.columns(1)" creates two blocks, a parent
        # container with delta_path (0, 0), and a column child with
        # delta_path (0, 0, 0). If the final "placeholder.empty()" Delta
        # is composed with the parent container Delta, the frontend will
        # throw an error when it tries to add that column child to what is
        # now just an element, and not a block.
        return None

    new_delta_type = new_delta.WhichOneof("type")
    if new_delta_type == "new_element":
        return new_delta

    if new_delta_type == "add_block":
        return new_delta

    return None
