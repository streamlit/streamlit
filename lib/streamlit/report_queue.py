# Copyright 2018-2021 Streamlit Inc.
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
A queue of ForwardMsg associated with a particular report.
Whenever possible, message deltas are combined.
"""

import copy
import threading
from typing import Optional, List, Dict, Any, Tuple

from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

from streamlit.logger import get_logger
from streamlit import util

LOGGER = get_logger(__name__)


class ReportQueue:
    """Thread-safe queue that smartly accumulates the report's messages."""

    def __init__(self):
        self._lock = threading.Lock()
        self._queue: List[ForwardMsg] = []

        # A mapping of (delta_path -> _queue.indexof(msg)) for each
        # Delta message in the queue. We use this for coalescing
        # redundant outgoing Deltas (where a newer Delta supercedes
        # an older Delta, with the same delta_path, that's still in the
        # queue).
        self._delta_index_map: Dict[Tuple[int, ...], int] = dict()

    def __repr__(self) -> str:
        return util.repr_(self)

    def get_debug(self) -> Dict[str, Any]:
        from google.protobuf.json_format import MessageToDict

        return {
            "queue": [MessageToDict(m) for m in self._queue],
            "ids": list(self._delta_index_map.keys()),
        }

    def __iter__(self):
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
            # Optimize only if it's a delta message
            if not msg.HasField("delta"):
                self._queue.append(msg)
            else:
                # Deltas are uniquely identified by their delta_path.
                delta_key = tuple(msg.metadata.delta_path)

                if (
                    delta_key in self._delta_index_map
                    # This delta combination logic is "legacy" only,
                    # and will be removed when that option is gone.
                    and not msg.delta.HasField("arrow_add_rows")
                ):
                    # Combine the previous message into the new message.
                    index = self._delta_index_map[delta_key]
                    old_msg = self._queue[index]
                    composed_delta = compose_deltas(old_msg.delta, msg.delta)
                    new_msg = ForwardMsg()
                    new_msg.delta.CopyFrom(composed_delta)
                    new_msg.metadata.CopyFrom(msg.metadata)
                    self._queue[index] = new_msg
                else:
                    # Append this message to the queue, and store its index
                    # for future combining.
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


def compose_deltas(old_delta: Delta, new_delta: Delta) -> Delta:
    """Combines new_delta onto old_delta if possible.

    If combination takes place, returns old_delta, since it has the combined
    data. If not, returns new_delta.

    """
    new_delta_type = new_delta.WhichOneof("type")

    if new_delta_type == "new_element":
        return new_delta

    if new_delta_type == "add_block":
        return new_delta

    if new_delta_type == "add_rows":
        import streamlit.elements.legacy_data_frame as data_frame

        # We should make data_frame.add_rows *not* mutate any of the
        # inputs. In the meantime, we have to deepcopy the input that will be
        # mutated.
        composed_delta = copy.deepcopy(old_delta)
        data_frame.add_rows(composed_delta, new_delta, name=new_delta.add_rows.name)
        return composed_delta

    LOGGER.error("Old delta: %s;\nNew delta: %s;", old_delta, new_delta)

    raise NotImplementedError("Need to implement the compose code.")
