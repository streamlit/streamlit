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

    @parameterized.expand(
        [
            ("full_run", None),
            ("fragment_run", ["some_fragment"]),
        ]
    )
    def test_clear_keeps_run_identity_on_rewritten_script_finished(
        self, _name: str, fragment_ids_this_run: list[str] | None
    ):
        """A retained script_finished keeps metadata.run when its status is rewritten."""
        fmq = ForwardMsgQueue()

        # The finished run's only fragment is dropped, so a fragment clear
        # downgrades its finish too.
        fragment_delta = ForwardMsg()
        fragment_delta.delta.new_element.text.body = "text"
        fragment_delta.delta.fragment_id = "some_fragment"
        fragment_delta.metadata.delta_path[:] = make_delta_path(
            RootContainer.MAIN, (), 0
        )
        fmq.enqueue(fragment_delta)

        script_finished_msg = ForwardMsg()
        script_finished_msg.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
        )
        script_finished_msg.metadata.run.script_run_id = "finished_run_id"
        script_finished_msg.metadata.run.fragment_ids.append("some_fragment")
        fmq.enqueue(script_finished_msg)

        fmq.clear(
            retain_lifecycle_msgs=True, fragment_ids_this_run=fragment_ids_this_run
        )

        assert len(fmq._queue) == 1
        retained = fmq._queue[0]
        assert (
            retained.script_finished
            == ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
        )
        assert retained.metadata.run.script_run_id == "finished_run_id"
        assert list(retained.metadata.run.fragment_ids) == ["some_fragment"]
        assert not retained.metadata.HasField("delivery")

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

    @staticmethod
    def _fragment_delta(fragment_id: str, delta_path: list[int]) -> ForwardMsg:
        msg = ForwardMsg()
        msg.delta.new_element.text.body = fragment_id
        msg.delta.fragment_id = fragment_id
        msg.metadata.delta_path[:] = delta_path
        return msg

    @staticmethod
    def _fragment_finish(script_run_id: str, fragment_ids: list[str]) -> ForwardMsg:
        msg = ForwardMsg()
        msg.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
        )
        msg.metadata.run.script_run_id = script_run_id
        msg.metadata.run.fragment_ids.extend(fragment_ids)
        return msg

    @parameterized.expand(
        [
            # The next run reruns an unrelated fragment, so all of A's output
            # survives and A's cleanup must still run (issue #16708).
            ("unrelated_fragment", "frag-b", False),
            # A rendered a nested fragment that the next run reruns, so part of
            # A's output is dropped and its cleanup would remove live nodes.
            ("nested_fragment", "frag-a-child", True),
        ]
    )
    def test_fragment_clear_downgrades_fragment_finish_only_if_its_output_dropped(
        self, _name: str, next_fragment_id: str, expect_downgrade: bool
    ):
        """A finished fragment run keeps its success status unless this clear
        dropped part of that run's output.
        """
        fmq = ForwardMsgQueue()

        own_delta = self._fragment_delta(
            "frag-a", make_delta_path(RootContainer.MAIN, (1,), 1)
        )
        child_delta = self._fragment_delta(
            "frag-a-child", make_delta_path(RootContainer.MAIN, (1, 0), 0)
        )
        finished_msg = self._fragment_finish("run-a", ["frag-a"])

        for msg in (NEW_SESSION_MSG, own_delta, child_delta, finished_msg):
            fmq.enqueue(msg)

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=[next_fragment_id])

        retained_finish = next(
            m for m in fmq._queue if m.WhichOneof("type") == "script_finished"
        )
        expected_status = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
            if expect_downgrade
            else ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
        )
        assert retained_finish.script_finished == expected_status
        assert retained_finish.metadata.run.script_run_id == "run-a"
        assert list(retained_finish.metadata.run.fragment_ids) == ["frag-a"]
        assert not retained_finish.metadata.HasField("delivery")
        assert own_delta in fmq._queue

    def _enqueue_coalesced_fragment_run(self, fmq: ForwardMsgQueue) -> None:
        """Enqueue a finished run of fragments B and A."""
        fmq.enqueue(
            self._fragment_delta("frag-b", make_delta_path(RootContainer.MAIN, (), 0))
        )
        fmq.enqueue(
            self._fragment_delta("frag-a", make_delta_path(RootContainer.MAIN, (), 1))
        )
        fmq.enqueue(self._fragment_finish("run-coalesced", ["frag-b", "frag-a"]))

    def test_fragment_clear_records_dropped_fragments_of_coalesced_finish(self):
        """A coalesced run keeps its identity, and its delivery names the
        fragments whose output was dropped.
        """
        fmq = ForwardMsgQueue()
        self._enqueue_coalesced_fragment_run(fmq)

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-b"])

        retained_finish = fmq._queue[-1]
        assert retained_finish.script_finished == (
            ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
        )
        assert retained_finish.metadata.run.script_run_id == "run-coalesced"
        assert list(retained_finish.metadata.run.fragment_ids) == [
            "frag-b",
            "frag-a",
        ]
        assert list(retained_finish.metadata.delivery.dropped_fragment_ids) == [
            "frag-b"
        ]
        assert [m.delta.fragment_id for m in fmq._queue[:-1]] == ["frag-a"]

    def test_second_fragment_clear_downgrades_coalesced_finish_and_drops_partial_delivery(
        self,
    ):
        """Fragments dropped by earlier clears count toward a later clear, and
        the downgrade discards the earlier partial-drop record.
        """
        fmq = ForwardMsgQueue()
        self._enqueue_coalesced_fragment_run(fmq)

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-b"])
        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-a"])

        assert len(fmq._queue) == 1
        retained_finish = fmq._queue[0]
        assert retained_finish.script_finished == (
            ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
        )
        assert list(retained_finish.metadata.run.fragment_ids) == [
            "frag-b",
            "frag-a",
        ]
        assert not retained_finish.metadata.HasField("delivery")

    def test_single_fragment_clear_of_every_fragment_downgrades_coalesced_finish(
        self,
    ):
        """Dropping every fragment of a coalesced run leaves nothing to clean up."""
        fmq = ForwardMsgQueue()
        self._enqueue_coalesced_fragment_run(fmq)

        fmq.clear(
            retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-a", "frag-b"]
        )

        assert len(fmq._queue) == 1
        retained_finish = fmq._queue[0]
        assert retained_finish.script_finished == (
            ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
        )
        assert list(retained_finish.metadata.run.fragment_ids) == [
            "frag-b",
            "frag-a",
        ]
        assert not retained_finish.metadata.HasField("delivery")

    def test_fragment_clear_downgrades_coalesced_finish_when_nested_fragment_dropped(
        self,
    ):
        """Dropping one of the run's own fragments and a fragment nested in
        another of them still downgrades: cleanup of the remaining fragment
        would remove the nested fragment's live output.
        """
        fmq = ForwardMsgQueue()
        for msg in (
            self._fragment_delta("frag-a", make_delta_path(RootContainer.MAIN, (), 0)),
            self._fragment_delta("frag-b", make_delta_path(RootContainer.MAIN, (), 1)),
            self._fragment_delta(
                "frag-x", make_delta_path(RootContainer.MAIN, (1, 0), 0)
            ),
            self._fragment_finish("run-coalesced", ["frag-a", "frag-b"]),
        ):
            fmq.enqueue(msg)

        fmq.clear(
            retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-a", "frag-x"]
        )

        retained_finish = fmq._queue[-1]
        assert retained_finish.script_finished == (
            ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
        )
        assert not retained_finish.metadata.HasField("delivery")

    def test_fragment_clear_ignores_drops_from_a_run_without_a_finish(self):
        """Deltas of a run that was replaced before it sent a script_finished
        don't count against the next run's finish.
        """
        fmq = ForwardMsgQueue()
        for msg in (
            self._fragment_delta("frag-a", make_delta_path(RootContainer.MAIN, (), 0)),
            NEW_SESSION_MSG,
            self._fragment_delta("frag-c", make_delta_path(RootContainer.MAIN, (), 1)),
            self._fragment_finish("run-c", ["frag-c"]),
        ):
            fmq.enqueue(msg)

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-a"])

        retained_finish = fmq._queue[-1]
        assert retained_finish.script_finished == (
            ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
        )
        assert not retained_finish.metadata.HasField("delivery")

    def test_fragment_clear_downgrades_unattributed_fragment_finish(self):
        """A finish without run identity can't name a delivered subset."""
        fmq = ForwardMsgQueue()
        fmq.enqueue(
            self._fragment_delta("frag-a", make_delta_path(RootContainer.MAIN, (), 0))
        )
        finished_msg = ForwardMsg()
        finished_msg.script_finished = (
            ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY
        )
        fmq.enqueue(finished_msg)

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-a"])

        assert fmq._queue == [finished_msg]
        assert finished_msg.script_finished == (
            ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN
        )
        assert not finished_msg.metadata.HasField("run")
        assert not finished_msg.metadata.HasField("delivery")

    def test_fragment_clear_tracks_dropped_output_per_finished_run(self):
        """Dropped output of an earlier run must not downgrade a later run."""
        fmq = ForwardMsgQueue()

        for run_id, fragment_id, index in (
            ("run-b1", "frag-b", 0),
            ("run-a", "frag-a", 1),
        ):
            new_session_msg = ForwardMsg()
            new_session_msg.new_session.name = "script.py"
            new_session_msg.metadata.run.script_run_id = run_id
            new_session_msg.metadata.run.fragment_ids.append(fragment_id)
            fmq.enqueue(new_session_msg)
            fmq.enqueue(
                self._fragment_delta(
                    fragment_id, make_delta_path(RootContainer.MAIN, (), index)
                )
            )
            fmq.enqueue(self._fragment_finish(run_id, [fragment_id]))

        fmq.clear(retain_lifecycle_msgs=True, fragment_ids_this_run=["frag-b"])

        statuses = {
            m.metadata.run.script_run_id: m.script_finished
            for m in fmq._queue
            if m.WhichOneof("type") == "script_finished"
        }
        assert statuses == {
            "run-b1": ForwardMsg.ScriptFinishedStatus.FINISHED_EARLY_FOR_RERUN,
            "run-a": ForwardMsg.ScriptFinishedStatus.FINISHED_FRAGMENT_RUN_SUCCESSFULLY,
        }

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


def test_enqueue_composes_ref_hash_onto_existing_delta() -> None:
    """A ``ref_hash`` message replaces the previous delta at the same path."""
    fmq = ForwardMsgQueue()
    old_msg = copy.deepcopy(TEXT_DELTA_MSG1)
    old_msg.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)
    fmq.enqueue(old_msg)

    ref_msg = ForwardMsg()
    ref_msg.ref_hash = "abc123"
    ref_msg.metadata.delta_path[:] = list(old_msg.metadata.delta_path)
    fmq.enqueue(ref_msg)

    queue = fmq.flush()
    assert len(queue) == 1
    assert queue[0].ref_hash == "abc123"


def test_enqueue_keeps_same_path_transient_messages() -> None:
    """Same-path ``new_transient`` deltas stay individually queued."""
    fmq = ForwardMsgQueue()
    old_msg = copy.deepcopy(TEXT_DELTA_MSG1)
    old_msg.metadata.delta_path[:] = make_delta_path(RootContainer.MAIN, (), 0)
    fmq.enqueue(old_msg)

    transient_msg = ForwardMsg()
    transient_msg.delta.new_transient.SetInParent()
    transient_msg.metadata.delta_path[:] = list(old_msg.metadata.delta_path)
    fmq.enqueue(transient_msg)

    queue = fmq.flush()
    assert len(queue) == 2
    assert queue[0].delta.new_element.text.body == "text1"
    assert queue[1].delta.WhichOneof("type") == "new_transient"
