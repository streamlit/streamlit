# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg

if TYPE_CHECKING:
    from collections.abc import Callable


class ForwardMsgQueue:
    """Accumulates a session's outgoing ForwardMsgs.

    Each AppSession adds messages to its queue, and the Server periodically
    flushes all session queues and delivers their messages to the appropriate
    clients.

    ForwardMsgQueue is not thread-safe - a queue should only be used from
    a single thread.
    """

    _before_enqueue_msg: Callable[[ForwardMsg], None] | None = None

    @staticmethod
    def on_before_enqueue_msg(
        before_enqueue_msg: Callable[[ForwardMsg], None] | None,
    ) -> None:
        """Set a callback to be called before a message is enqueued.
        Used in static streamlit app generation.
        """
        ForwardMsgQueue._before_enqueue_msg = before_enqueue_msg

    def __init__(self) -> None:
        self._queue: list[ForwardMsg] = []
        # A mapping of (delta_path -> _queue.indexof(msg)) for each
        # Delta message in the queue. We use this for coalescing
        # redundant outgoing Deltas (where a newer Delta supersedes
        # an older Delta, with the same delta_path, that's still in the
        # queue).
        self._delta_index_map: dict[tuple[int, ...], int] = {}

    def get_debug(self) -> dict[str, Any]:
        from google.protobuf.json_format import MessageToDict

        return {
            "queue": [MessageToDict(m) for m in self._queue],
            "ids": list(self._delta_index_map.keys()),
        }

    def is_empty(self) -> bool:
        return len(self._queue) == 0

    def enqueue(self, msg: ForwardMsg) -> None:
        """Add message into queue, possibly composing it with another message."""

        if ForwardMsgQueue._before_enqueue_msg:
            ForwardMsgQueue._before_enqueue_msg(msg)

        if not _is_composable_message(msg):
            self._queue.append(msg)
            return

        # If there's a Delta message with the same delta_path already in
        # the queue - meaning that it refers to the same location in
        # the app - we attempt to combine this new Delta into the old
        # one. This is an optimization that prevents redundant Deltas
        # from being sent to the frontend.
        # One common case where this happens is with `st.write` since
        # it uses a trick with `st.empty` to handle lists of args.
        # Note: its not guaranteed that the optimization is always applied
        # since the queue can be flushed to the browser at any time.
        # For example:
        # queue 1:
        # > empty [0, 0]  <- skipped
        # > markdown [0, 0]
        # > empty [1, 0]  <- send to frontend
        #
        # queue 2:
        # > markdown [1, 0]
        # > ...

        delta_key = tuple(msg.metadata.delta_path)
        if delta_key in self._delta_index_map:
            index = self._delta_index_map[delta_key]
            old_msg = self._queue[index]
            composed_msg = _maybe_compose_delta_msgs(old_msg, msg)
            if composed_msg is not None:
                self._queue[index] = composed_msg
                return

        # No composition occurred. Append this message to the queue, and
        # store its index for potential future composition.
        self._delta_index_map[delta_key] = len(self._queue)
        self._queue.append(msg)

    def clear(
        self,
        retain_lifecycle_msgs: bool = False,
        fragment_ids_this_run: list[str] | None = None,
    ) -> None:
        """Clear the queue, potentially retaining lifecycle messages.

        The retain_lifecycle_msgs argument exists because in some cases (in particular
        when a currently running script is interrupted by a new BackMsg), we don't want
        to remove certain messages from the queue as doing so may cause the client to
        not hear about important script lifecycle events (such as the script being
        stopped early in order to be rerun).

        If fragment_ids_this_run is provided, delta messages not belonging to any
        fragment or belonging to a fragment not in fragment_ids_this_run will be
        preserved to prevent clearing messages unrelated to the running fragments.
        """

        if not retain_lifecycle_msgs:
            self._queue = []
        else:
            self._queue = [
                _update_script_finished_message(msg, fragment_ids_this_run is not None)
                for msg in self._queue
                if msg.WhichOneof("type")
                in {
                    "new_session",
                    "script_finished",
                    "session_status_changed",
                    "parent_message",
                }
                or (
                    # preserve all messages if this is a fragment rerun and...
                    fragment_ids_this_run is not None
                    and (
                        # the message is not a delta message
                        # (not associated with a fragment) or...
                        msg.delta is None
                        or (
                            # it is a delta but not associated with any of the passed
                            # fragments
                            msg.delta is not None
                            and (
                                msg.delta.fragment_id is None
                                or msg.delta.fragment_id not in fragment_ids_this_run
                            )
                        )
                    )
                )
            ]

        self._delta_index_map = {}

    def flush(self) -> list[ForwardMsg]:
        """Clear the queue and return a list of the messages it contained
        before being cleared.
        """
        queue = self._queue
        self.clear()
        return queue

    def __len__(self) -> int:
        return len(self._queue)


def _is_composable_message(msg: ForwardMsg) -> bool:
    """True if the ForwardMsg is potentially composable with other ForwardMsgs."""
    if msg.HasField("ref_hash"):
        # reference messages (cached in frontend) are always composable.
        # Only new_element deltas can be reference messages.
        return True

    if not msg.HasField("delta"):
        # Non-delta messages are never composable.
        return False

    # We never compose add_rows messages in Python, because the add_rows
    # operation can raise errors, and we don't have a good way of handling
    # those errors in the message queue.
    delta_type = msg.delta.WhichOneof("type")
    return delta_type not in {"add_rows", "arrow_add_rows"}


def _maybe_compose_delta_msgs(
    old_msg: ForwardMsg, new_msg: ForwardMsg
) -> ForwardMsg | None:
    """Optimization logic that composes new_msg onto old_msg if possible.

    If the combination takes place, the function returns a new ForwardMsg that
    should replace old_msg in the queue. This basically means that the old_msg
    is not send to the browser since its considered unnecessary.

    If the new_msg is incompatible with old_msg, the function returns None.
    In this case, the new_msg should just be appended to the queue as normal.
    """

    if old_msg.HasField("delta") and old_msg.delta.WhichOneof("type") == "add_block":
        # We never replace add_block deltas, because blocks can have
        # other dependent deltas later in the queue. For example:
        #
        # >  placeholder = st.empty()
        # >  placeholder.columns(1)
        # >  placeholder.empty()
        #
        # The call to "placeholder.columns(1)" creates two blocks, a parent
        # container with delta_path (0, 0), and a column child with
        # delta_path (0, 0, 0). If the final "placeholder.empty()" Delta
        # is composed with the parent container Delta, the frontend will
        # throw an error when it tries to add that column child to what is
        # now just an element, and not a block.
        return None

    if new_msg.HasField("ref_hash"):
        # ref_hash messages are always composable.
        # Only new_element deltas can be reference messages.
        return new_msg

    new_delta_type = new_msg.delta.WhichOneof("type")
    if new_delta_type in {"new_element", "add_block"}:
        return new_msg

    return None


def _update_script_finished_message(
    msg: ForwardMsg, is_fragment_run: bool
) -> ForwardMsg:
    """
    When we are here, the message queue is cleared from non-lifecycle messages
    before they were flushed to the browser.

    If there were no non-lifecycle messages in the queue, changing the type here
    should not matter for the frontend anyways, so we optimistically change the
    `script_finished` message to `FINISHED_EARLY_FOR_RERUN`. This indicates to
    the frontend that the previous run was interrupted by a new script start.
    Otherwise, a `FINISHED_SUCCESSFULLY` message might trigger a reset of widget
    states on the frontend.
    """
    if msg.WhichOneof("type") == "script_finished" and (
        # If this is not a fragment run (= full app run), its okay to change the
        # script_finished type to FINISHED_EARLY_FOR_RERUN because another full app run
        # is about to start.
        # If this is a fragment run, it is allowed to change the state of
        # all script_finished states except for FINISHED_SUCCESSFULLY, which we use to
        # indicate that a full app run has finished successfully (in other words, a
        # fragment should not modify the finished status of a full app run, because
        # the fragment finished state is different and the frontend might not trigger
        # cleanups etc. correctly).
        is_fragment_run is False
        or msg.script_finished != ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
    ):
        msg.script_finished = ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
    return msg
