# Copyright 2018-2020 Streamlit Inc.
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

import threading
from collections import deque
from collections import namedtuple
from enum import Enum

from streamlit.widgets import coalesce_widget_states


class ScriptRequest(Enum):
    # Stop the script, but don't shutdown the ScriptRunner (data=None)
    STOP = "STOP"
    # Rerun the script (data=RerunData)
    RERUN = "RERUN"
    # Shut down the ScriptRunner, stopping any running script first (data=None)
    SHUTDOWN = "SHUTDOWN"


# Data attached to RERUN requests
RerunData = namedtuple(
    "RerunData",
    [
        # WidgetStates protobuf to run the script with. If this is None, the
        # widget_state from the most recent run of the script will be used instead.
        "widget_state"
    ],
)


class ScriptRequestQueue(object):
    """A thread-safe queue of ScriptRequests.

    ReportSession publishes to this queue, and ScriptRunner consumes from it.

    """

    def __init__(self):
        self._lock = threading.Lock()
        # TODO(nate): Switch to Deque[Tuple[ScriptRequest, Any]] when 3.6 is required.
        self._queue = deque()  # type: ignore[var-annotated]

    @property
    def has_request(self):
        """True if the queue has at least one element"""
        with self._lock:
            return len(self._queue) > 0

    def enqueue(self, request, data=None):
        """Enqueue a new request to the end of the queue.

        This request may be coalesced with an existing request if appropriate.
        For example, multiple consecutive RERUN requests will be combined
        so that there's only ever one pending RERUN request in the queue
        at a time.

        Parameters
        ----------
        request : ScriptRequest
            The type of request

        data : Any
            Data associated with the request, if any
        """
        with self._lock:
            if request == ScriptRequest.SHUTDOWN:
                # If we get a shutdown request, it jumps to the front of the
                # queue to be processed immediately.
                self._queue.appendleft((request, data))
            elif request == ScriptRequest.RERUN:
                index = _index_if(self._queue, lambda item: item[0] == request)
                if index >= 0:
                    _, old_data = self._queue[index]

                    if old_data.widget_state is None:
                        # The existing request's widget_state is None, which
                        # means it wants to rerun with whatever the most
                        # recent script execution's widget state was.
                        # We have no meaningful state to merge with, and
                        # so we simply overwrite the existing request.
                        self._queue[index] = (
                            request,
                            RerunData(widget_state=data.widget_state),
                        )
                    elif data.widget_state is None:
                        # If this request's widget_state is None, and the
                        # existing request's widget_state was not, this
                        # new request is entirely redundant and can be dropped.
                        pass
                    else:
                        # Both the existing and the new request have
                        # non-null widget_states. Merge them together.
                        coalesced_state = coalesce_widget_states(
                            old_data.widget_state, data.widget_state
                        )
                        self._queue[index] = (
                            request,
                            RerunData(widget_state=coalesced_state),
                        )
                else:
                    self._queue.append((request, data))
            else:
                self._queue.append((request, data))

    def dequeue(self):
        """Pops the front-most request from the queue and returns it.

        Returns (None, None) if the queue is empty.

        Returns
        -------
        A (ScriptRequest, Data) tuple.
        """
        with self._lock:
            if len(self._queue) > 0:
                return self._queue.popleft()
            else:
                return None, None


def _index_if(collection, pred):
    """Find the index of the first item in a collection for which a predicate is true.

    Returns the index, or -1 if no such item exists.
    """
    for index, element in enumerate(collection):
        if pred(element):
            return index
    return -1
