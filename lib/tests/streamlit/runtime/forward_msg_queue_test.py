# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

"""Unit test of ForwardMsgQueue.py."""

from __future__ import annotations

import copy
import unittest

from parameterized import parameterized

from streamlit.cursor import make_delta_path
from streamlit.elements import arrow
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.forward_msg_queue import (
    ForwardMsgQueue,
    _maybe_compose_delta_msgs,
)

# For the messages below, we don't really care about their contents so much as
# their general type.

NEW_SESSION_MSG = ForwardMsg()
NEW_SESSION_MSG.new_session.config.allow_run_on_save = True

PAGE_INFO_CHANGED_MSG = ForwardMsg()
PAGE_INFO_CHANGED_MSG.page_info_changed.query_string = "foo=bar"

TEXT_DELTA_MSG1 = ForwardMsg()
TEXT_DELTA_MSG1.delta.new_element.text.body = "text1"
TEXT_DELTA_MSG1.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

TEXT_DELTA_MSG2 = ForwardMsg()
TEXT_DELTA_MSG2.delta.new_element.text.body = "text2"
TEXT_DELTA_MSG2.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

ADD_BLOCK_MSG = ForwardMsg()
ADD_BLOCK_MSG.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

DF_DELTA_MSG = ForwardMsg()
arrow.marshall(
    DF_DELTA_MSG.delta.new_element.dataframe.arrow_data,
    {"col1": [0, 1, 2], "col2": [10, 11, 12]},
)
DF_DELTA_MSG.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

TOAST_DELTA_MSG = ForwardMsg()
TOAST_DELTA_MSG.delta.new_element.toast.body = "toast body"
TOAST_DELTA_MSG.metadata.delta_path[:] = make_delta_path(RootContainer.EVENT, (), 0)

# A toast emitted from within a fragment (its delta carries the fragment id).
FRAGMENT_TOAST_DELTA_MSG = ForwardMsg()
FRAGMENT_TOAST_DELTA_MSG.delta.new_element.toast.body = "fragment toast body"
FRAGMENT_TOAST_DELTA_MSG.delta.fragment_id = "some_fragment"
FRAGMENT_TOAST_DELTA_MSG.metadata.delta_path[:] = make_delta_path(
    RootContainer.EVENT, (), 0
)

# A regular (non-toast) delta emitted from within the same fragment.
FRAGMENT_TEXT_DELTA_MSG = ForwardMsg()
FRAGMENT_TEXT_DELTA_MSG.delta.new_element.text.body = "fragment text"
FRAGMENT_TEXT_DELTA_MSG.delta.fragment_id = "some_fragment"
FRAGMENT_TEXT_DELTA_MSG.metadata.delta_path[:] = make_delta_path(
    RootContainer.MAIN, (), 0
)


class ForwardMsgQueueTest(unittest.TestCase):
    def test_simple_enqueue(self):
        """Enqueue a single ForwardMsg."""
        fmq = ForwardMsgQueue()
        assert fmq.is_empty()

        fmq.enqueue(NEW_SESSION_MSG)

        assert not fmq.is_empty()
        queue = fmq.flush()
        assert fmq.is_empty()
        assert len(queue) == 1
        assert queue[0].new_session.config.allow_run_on_save

    def test_enqueue_two(self):
        """Enqueue two ForwardMsgs."""
        fmq = ForwardMsgQueue()
        assert fmq.is_empty()

        fmq.enqueue(NEW_SESSION_MSG)

        TEXT_DELTA_MSG1.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(TEXT_DELTA_MSG1)

        queue = fmq.flush()
        assert len(queue) == 2
        assert (
            make_delta_path(RootContainer.MAIN, (), 0) == queue[1].metadata.delta_path
        )
        assert queue[1].delta.new_element.text.body == "text1"

    def test_enqueue_three(self):
        """Enqueue 3 ForwardMsgs."""
        fmq = ForwardMsgQueue()
        assert fmq.is_empty()

        fmq.enqueue(NEW_SESSION_MSG)

        TEXT_DELTA_MSG1.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(TEXT_DELTA_MSG1)

        TEXT_DELTA_MSG2.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 1
        )
        fmq.enqueue(TEXT_DELTA_MSG2)

        queue = fmq.flush()
        assert len(queue) == 3
        assert (
            make_delta_path(RootContainer.MAIN, (), 0) == queue[1].metadata.delta_path
        )
        assert queue[1].delta.new_element.text.body == "text1"
        assert (
            make_delta_path(RootContainer.MAIN, (), 1) == queue[2].metadata.delta_path
        )
        assert queue[2].delta.new_element.text.body == "text2"

    def test_replace_element(self):
        """Enqueuing an element with the same delta_path as another element
        already in the queue should replace the original element.
        """
        fmq = ForwardMsgQueue()
        assert fmq.is_empty()

        fmq.enqueue(NEW_SESSION_MSG)

        TEXT_DELTA_MSG1.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(TEXT_DELTA_MSG1)

        TEXT_DELTA_MSG2.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(TEXT_DELTA_MSG2)

        queue = fmq.flush()
        assert len(queue) == 2
        assert (
            make_delta_path(RootContainer.MAIN, (), 0) == queue[1].metadata.delta_path
        )
        assert queue[1].delta.new_element.text.body == "text2"

    @parameterized.expand([(TEXT_DELTA_MSG1,), (ADD_BLOCK_MSG,)])
    def test_dont_replace_block(self, other_msg: ForwardMsg):
        """add_block deltas should never be replaced because they can
        have dependent deltas later in the queue."""
        fmq = ForwardMsgQueue()
        assert fmq.is_empty()

        ADD_BLOCK_MSG.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )

        other_msg.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

        # Delta messages should not replace `add_block` deltas with the
        # same delta_path.
        fmq.enqueue(ADD_BLOCK_MSG)
        fmq.enqueue(other_msg)
        queue = fmq.flush()
        assert len(queue) == 2
        assert queue[0] == ADD_BLOCK_MSG
        assert other_msg == queue[1]

    def test_multiple_containers(self):
        """Deltas should only be coalesced if they're in the same container"""
        fmq = ForwardMsgQueue()
        assert fmq.is_empty()

        fmq.enqueue(NEW_SESSION_MSG)

        def enqueue_deltas(container: int, path: tuple[int, ...]):
            # We deep-copy the protos because we mutate each one
            # multiple times.
            msg = copy.deepcopy(TEXT_DELTA_MSG1)
            msg.metadata.delta_path[:] = make_delta_path(container, path, 0)
            fmq.enqueue(msg)

            msg = copy.deepcopy(DF_DELTA_MSG)
            msg.metadata.delta_path[:] = make_delta_path(container, path, 1)
            fmq.enqueue(msg)

        enqueue_deltas(RootContainer.MAIN, ())
        enqueue_deltas(RootContainer.SIDEBAR, (0, 0, 1))

        def assert_deltas(container: int, path: tuple[int, ...], idx: int):
            # Text delta
            assert make_delta_path(container, path, 0) == queue[idx].metadata.delta_path
            assert queue[idx].delta.new_element.text.body == "text1"

        queue = fmq.flush()
        assert len(queue) == 5

        assert_deltas(RootContainer.MAIN, (), 1)
        assert_deltas(RootContainer.SIDEBAR, (0, 0, 1), 3)

    def test_clear_retain_lifecycle_msgs(self):
        fmq = ForwardMsgQueue()

        script_finished_msg = ForwardMsg()
        script_finished_msg.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
        )

        session_status_changed_msg = ForwardMsg()
        session_status_changed_msg.session_status_changed.script_is_running = True

        parent_msg = ForwardMsg()
        parent_msg.parent_message.message = "hello"

        fmq.enqueue(NEW_SESSION_MSG)
        fmq.enqueue(TEXT_DELTA_MSG1)
        fmq.enqueue(script_finished_msg)
        fmq.enqueue(session_status_changed_msg)
        fmq.enqueue(parent_msg)
        fmq.enqueue(PAGE_INFO_CHANGED_MSG)

        expected_new_finished_message = ForwardMsg()
        expected_new_finished_message.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
        )

        fmq.clear(retain_lifecycle_msgs=True)
        expected_retained_messages = [
            NEW_SESSION_MSG,
            expected_new_finished_message,
            session_status_changed_msg,
            parent_msg,
            PAGE_INFO_CHANGED_MSG,
        ]
        assert fmq._queue == expected_retained_messages

        fmq.clear()
        assert fmq._queue == []

    def test_clear_retains_toast_deltas(self):
        """Toast deltas survive a lifecycle-retaining clear (issue #7740).

        A ``st.toast()`` immediately followed by ``st.rerun()`` interrupts the
        run and clears the queue with ``retain_lifecycle_msgs=True`` before it is
        flushed. The toast delta must be preserved so the toast still reaches the
        browser, while regular (non-toast) deltas are still dropped.
        """
        fmq = ForwardMsgQueue()

        fmq.enqueue(NEW_SESSION_MSG)
        fmq.enqueue(TEXT_DELTA_MSG1)
        fmq.enqueue(TOAST_DELTA_MSG)

        fmq.clear(retain_lifecycle_msgs=True)

        # The toast delta is retained, the regular text delta is dropped.
        assert NEW_SESSION_MSG in fmq._queue
        assert TOAST_DELTA_MSG in fmq._queue
        assert TEXT_DELTA_MSG1 not in fmq._queue

    def test_clear_retains_toast_deltas_during_fragment_rerun(self):
        """Toast deltas survive a fragment-scoped lifecycle-retaining clear.

        ``_is_toast_delta`` is a top-level condition, so a toast is retained even
        during a fragment rerun - including a toast emitted by the running
        fragment itself, which would otherwise be dropped so it can be re-run.
        This locks in that ``st.toast()`` + ``st.rerun()`` inside a
        ``@st.fragment`` is covered too. Regular deltas of the running fragment
        are still dropped.
        """
        fmq = ForwardMsgQueue()

        fmq.enqueue(NEW_SESSION_MSG)
        fmq.enqueue(FRAGMENT_TEXT_DELTA_MSG)
        fmq.enqueue(FRAGMENT_TOAST_DELTA_MSG)

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["some_fragment"])

        # The fragment's toast is retained even though it belongs to the running
        # fragment, while the fragment's regular text delta is dropped.
        assert FRAGMENT_TOAST_DELTA_MSG in fmq._queue
        assert FRAGMENT_TEXT_DELTA_MSG not in fmq._queue

    def test_clear_without_retain_drops_toast_deltas(self):
        """A full (non-lifecycle) clear still drops toast deltas.

        Toast retention is specific to lifecycle-retaining clears (rerun/
        interrupt); a normal flush must not leave stale toast deltas behind.
        """
        fmq = ForwardMsgQueue()

        fmq.enqueue(TOAST_DELTA_MSG)
        fmq.clear()

        assert fmq._queue == []

    def test_clear_with_fragmentid_preserve_unrelated_delta_messages(self):
        """When we pass fragment_ids_this_run to the clear function, only delta
        messages belonging to those fragment_ids should be cleared or in other words,
        all other delta messages not belonging to one of the passed fragment ids, should
        be preserved.
        """
        fmq = ForwardMsgQueue()

        script_finished_msg = ForwardMsg()
        script_finished_msg.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
        )

        session_status_changed_msg = ForwardMsg()
        session_status_changed_msg.session_status_changed.script_is_running = True

        parent_msg = ForwardMsg()
        parent_msg.parent_message.message = "hello"

        current_fragment_delta1 = ForwardMsg()
        current_fragment_delta1.delta.new_element.text.body = "text1"
        current_fragment_delta1.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 1
        )
        current_fragment_delta1.delta.fragment_id = "current_fragment_id1"

        current_fragment_delta2 = ForwardMsg()
        current_fragment_delta2.delta.new_element.text.body = "text1"
        current_fragment_delta2.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 2
        )
        current_fragment_delta2.delta.fragment_id = "current_fragment_delta2"

        unrelated_fragment_delta = ForwardMsg()
        unrelated_fragment_delta.delta.new_element.text.body = "text1"
        unrelated_fragment_delta.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 3
        )
        unrelated_fragment_delta.delta.fragment_id = "unrelated_fragment_id"

        fmq.enqueue(NEW_SESSION_MSG)
        fmq.enqueue(current_fragment_delta1)
        fmq.enqueue(current_fragment_delta2)
        fmq.enqueue(unrelated_fragment_delta)
        fmq.enqueue(TEXT_DELTA_MSG1)  # no fragment id
        fmq.enqueue(script_finished_msg)
        fmq.enqueue(session_status_changed_msg)
        fmq.enqueue(parent_msg)

        expected_new_finished_message = ForwardMsg()
        expected_new_finished_message.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_SUCCESSFULLY
        )

        fmq.clear(
            retain_lifecycle_msgs=True,
            fragment_ids_this_run=[
                current_fragment_delta1.delta.fragment_id,
                current_fragment_delta2.delta.fragment_id,
            ],
        )
        expected_retained_messages = [
            NEW_SESSION_MSG,
            unrelated_fragment_delta,
            TEXT_DELTA_MSG1,
            expected_new_finished_message,
            session_status_changed_msg,
            parent_msg,
        ]
        assert fmq._queue == expected_retained_messages

        fmq.clear()
        assert fmq._queue == []

    def test_on_before_enqueue_msg(self):
        count = 0

        def increase_counter(_msg):
            nonlocal count
            count += 1

        ForwardMsgQueue.on_before_enqueue_msg(increase_counter)
        fmq = ForwardMsgQueue()

        assert count == 0

        fmq.enqueue(NEW_SESSION_MSG)

        TEXT_DELTA_MSG1.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(TEXT_DELTA_MSG1)

        TEXT_DELTA_MSG2.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 1
        )
        fmq.enqueue(TEXT_DELTA_MSG2)

        assert count == 3

        count = 0

        ForwardMsgQueue.on_before_enqueue_msg(None)
        fmq.clear()

        fmq.enqueue(NEW_SESSION_MSG)

        TEXT_DELTA_MSG1.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(TEXT_DELTA_MSG1)

        TEXT_DELTA_MSG2.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 1
        )
        fmq.enqueue(TEXT_DELTA_MSG2)

        assert count == 0


def test_get_debug_includes_queued_messages_and_delta_ids() -> None:
    """``get_debug`` serializes queued messages and their delta-path indexes."""
    fmq = ForwardMsgQueue()
    fmq.enqueue(TEXT_DELTA_MSG1)
    debug = fmq.get_debug()
    assert len(debug["queue"]) == 1
    assert debug["ids"] == [tuple(TEXT_DELTA_MSG1.metadata.delta_path)]


def test_maybe_compose_delta_msgs_returns_ref_hash_and_uncomposable_types() -> None:
    """Reference messages replace the old delta; ``new_transient`` deltas do not compose."""
    old_msg = ForwardMsg()
    old_msg.delta.new_element.text.body = "old"
    old_msg.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)

    ref_msg = ForwardMsg()
    ref_msg.ref_hash = "abc123"
    assert _maybe_compose_delta_msgs(old_msg, ref_msg) is ref_msg

    transient_msg = ForwardMsg()
    transient_msg.delta.new_transient.SetInParent()
    transient_msg.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)
    assert _maybe_compose_delta_msgs(old_msg, transient_msg) is None
