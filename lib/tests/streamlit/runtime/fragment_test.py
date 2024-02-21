# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2024)
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

import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.fragment import MemoryFragmentStorage, fragment
from streamlit.runtime.scriptrunner.script_run_context import dg_stack


class MemoryFragmentStorageTest(unittest.TestCase):
    """Sanity checks for MemoryFragmentStorage.

    These tests may be a bit excessive given that MemoryFragmentStorage is currently
    just a wrapper around a Python dict, but we include them for completeness.
    """

    def setUp(self):
        self._storage = MemoryFragmentStorage()
        self._storage._fragments["some_key"] = "some_fragment"

    def test_get(self):
        assert self._storage.get("some_key") == "some_fragment"

    def test_get_KeyError(self):
        with pytest.raises(KeyError):
            self._storage.get("nonexistent_key")

    def test_set(self):
        self._storage.set("some_key", "new_fragment")
        self._storage.set("some_other_key", "some_other_fragment")

        assert self._storage.get("some_key") == "new_fragment"
        assert self._storage.get("some_other_key") == "some_other_fragment"

    def test_delete(self):
        self._storage.delete("some_key")
        with pytest.raises(KeyError):
            self._storage.get("nonexistent_key")

    def test_del_KeyError(self):
        with pytest.raises(KeyError):
            self._storage.delete("nonexistent_key")

    def test_clear(self):
        self._storage._fragments["some_other_key"] = "some_other_fragment"
        assert len(self._storage._fragments) == 2

        self._storage.clear()
        assert len(self._storage._fragments) == 0


class FragmentTest(unittest.TestCase):
    def setUp(self):
        dg_stack.set(())

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    def test_wrapped_fragment_calls_original_function(self):
        # Sanity check that we don't currently have a wrapping container.
        assert len(dg_stack.get()) == 0

        called = False

        @fragment
        def my_fragment():
            nonlocal called
            called = True

            # Verify that a container was added automagically.
            assert len(dg_stack.get()) == 1

        my_fragment()
        assert called

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    def test_fragment_with_run_every(self):
        # TODO(vdonato): Actually test that run_every works properly once we implement
        # the parameter. We still add this test for now to verify that we can call
        # the @fragment decorator with an argument.
        called = False

        @fragment(run_every=5.0)
        def my_fragment():
            nonlocal called
            called = True

        my_fragment()
        assert called

    @patch("streamlit.runtime.fragment.get_script_run_ctx", MagicMock())
    def test_does_not_add_container_if_unnecessary(self):
        dg_stack.set((MagicMock(), MagicMock()))

        called = False

        @fragment
        def my_fragment():
            nonlocal called
            called = True
            assert len(dg_stack.get()) == 2

        my_fragment()
        assert called

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_resets_current_fragment_id_on_success(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            pass

        ctx.current_fragment_id = "my_fragment_id"
        my_fragment()
        assert ctx.current_fragment_id is None

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_resets_current_fragment_id_on_exception(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_exploding_fragment():
            raise Exception("oh no")

        ctx.current_fragment_id = "my_fragment_id"
        with pytest.raises(Exception):
            my_exploding_fragment()
        assert ctx.current_fragment_id is None

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_wrapped_fragment_saved_in_FragmentStorage(
        self, patched_get_script_run_ctx
    ):
        ctx = MagicMock()
        patched_get_script_run_ctx.return_value = ctx

        @fragment
        def my_fragment():
            pass

        my_fragment()

        ctx.fragment_storage.set.assert_called_once()

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sets_dg_stack_to_snapshot(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        dg = MagicMock()
        dg.my_random_field = 7
        dg_stack.set((dg,))

        call_count = 0

        @fragment
        def my_fragment():
            nonlocal call_count

            curr_dg_stack = dg_stack.get()
            assert curr_dg_stack[0].my_random_field == 7

            # Attempt to mutate the dg_stack.
            curr_dg_stack[0].my_random_field += 1

            call_count += 1

        my_fragment()

        # Reach inside our MemoryFragmentStorage internals to pull out our saved
        # fragment.
        saved_fragment = list(ctx.fragment_storage._fragments.values())[0]

        # Verify that we can't mutate our dg_stack from within my_fragment. If a
        # mutation is persisted between fragment runs, the assert on `my_random_field`
        # will fail.
        saved_fragment()
        saved_fragment()
        saved_fragment()

        # Called once when calling my_fragment and three times calling the saved
        # fragment.
        assert call_count == 4

    @patch("streamlit.runtime.fragment.get_script_run_ctx")
    def test_sends_message_if_run_every_arg_is_set(self, patched_get_script_run_ctx):
        ctx = MagicMock()
        ctx.fragment_storage = MemoryFragmentStorage()
        patched_get_script_run_ctx.return_value = ctx

        @fragment(run_every=5.0)
        def my_fragment():
            pass

        my_fragment()

        [(args, _)] = ctx.enqueue.call_args_list
        msg = args[0]
        assert msg.auto_rerun.interval == 5
        assert (
            isinstance(msg.auto_rerun.fragment_id, str)
            and msg.auto_rerun.fragment_id != ""
        )
