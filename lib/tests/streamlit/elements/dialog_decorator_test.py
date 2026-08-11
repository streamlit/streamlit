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

"""Tests for dialog decorator."""

from __future__ import annotations

from typing import TYPE_CHECKING
from unittest.mock import MagicMock, patch

import pytest

import streamlit as st
from streamlit.errors import StreamlitAPIException
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.scriptrunner_utils.script_run_context import ThreadState
from tests.delta_generator_test_case import DeltaGeneratorTestCase

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


def test_dialog_raises_from_parallel_worker() -> None:
    """@st.dialog raises StreamlitAPIException when called from a parallel worker."""
    ThreadState.initialize(is_parallel_worker=True)
    try:

        @st.dialog("Test")
        def my_dialog() -> None:
            st.write("Hello")

        with pytest.raises(StreamlitAPIException) as exc_info:
            my_dialog()

        assert "@st.dialog" in str(exc_info.value)
        assert "parallel fragment" in str(exc_info.value)
    finally:
        ThreadState.initialize(is_parallel_worker=False)


def test_dialog_allowed_when_not_parallel_worker() -> None:
    """@st.dialog calls _check_not_parallel_worker and does not raise when is_parallel_worker=False."""
    ThreadState.initialize(is_parallel_worker=False)
    try:
        with patch(
            "streamlit.elements.dialog_decorator._check_not_parallel_worker"
        ) as mock_check:
            # Decorator applies at definition time, so the check should be called
            # when my_dialog() is invoked

            # We still need to mock the dialog machinery to avoid errors from
            # incomplete setup, but we're specifically testing that:
            # 1. _check_not_parallel_worker is called
            # 2. It doesn't raise (because is_parallel_worker=False)
            with (
                patch("streamlit.elements.dialog_decorator.get_dg_singleton_instance"),
                patch(
                    "streamlit.elements.dialog_decorator.get_last_dg_added_to_context_stack",
                    return_value=None,
                ),
                patch("streamlit.runtime.fragment.get_script_run_ctx") as mock_ctx,
            ):
                mock_ctx.return_value = MagicMock()
                mock_ctx.return_value.fragment_storage = MagicMock()

                @st.dialog("Test")
                def my_dialog() -> None:
                    st.write("Hello")

                my_dialog()

            mock_check.assert_called_once_with("@st.dialog")
    finally:
        ThreadState.initialize(is_parallel_worker=False)


class DialogDeltaPathTest(DeltaGeneratorTestCase):
    """Tests that `@st.dialog` stores and reuses the delta path of its own block."""

    def _block_paths(self, block_type: str) -> list[list[int]]:
        """Return the delta paths of every queued add_block message of `block_type`."""
        return [
            list(msg.metadata.delta_path)
            for msg in self.forward_msg_queue._queue
            if msg.HasField("delta")
            and msg.delta.WhichOneof("type") == "add_block"
            and msg.delta.add_block.WhichOneof("type") == block_type
        ]

    def test_dialog_open_reuses_event_container_path(self) -> None:
        """A dialog opened from a fragment re-sends its block at the same path.

        `Dialog._update` enqueues the `dialog` block proto again at the path that
        `_create()` stored. Dialogs live on the event container, which never gets a
        layout-transparent wrapper, so no wrapper insertion can invalidate the stored
        path. This test pins that behavior and fails if dialog creation ever moves off
        the event container.
        """
        outside_container = st.container()

        @st.dialog("Delta path dialog")
        def my_dialog() -> None:
            st.write("content")

        ThreadState.update(fragment_id="frag", delta_path=(0, 99))
        self.addCleanup(lambda: ThreadState.update(fragment_id=None, delta_path=None))
        with outside_container:
            my_dialog()

        dialog_paths = self._block_paths("dialog")
        # One message from _create(), one from the open() that the decorator calls.
        assert len(dialog_paths) == 2
        assert dialog_paths[0][0] == RootContainer.EVENT
        assert dialog_paths[-1] == dialog_paths[0]

    def test_dialog_update_targets_the_block_when_a_wrapper_redirects_it(self) -> None:
        """The stored path follows the block when `_block()` redirects the write.

        The event container is not wrapper-eligible today, so the test above cannot
        tell `_block_delta_path` apart from the old parent-cursor prediction. This
        test forces `_needs_outside_wrapper()` to accept the event container, which
        makes `_block()` redirect the dialog into a transparent wrapper. The stored
        path must then point at the dialog, not at the wrapper.
        """

        def _wrapper_only_for_event_container(
            dg: DeltaGenerator, ts: object, fragment_storage: object
        ) -> bool:
            return dg._root_container == RootContainer.EVENT and dg._is_top_level

        @st.dialog("Wrapped dialog")
        def my_dialog() -> None:
            st.write("content")

        ThreadState.update(fragment_id="frag", delta_path=(0, 99))
        self.addCleanup(lambda: ThreadState.update(fragment_id=None, delta_path=None))

        with patch(
            "streamlit.delta_generator._needs_outside_wrapper",
            side_effect=_wrapper_only_for_event_container,
        ):
            my_dialog()

        wrapper_paths = self._block_paths("transparent")
        dialog_paths = self._block_paths("dialog")

        assert len(wrapper_paths) == 1
        assert wrapper_paths[0][0] == RootContainer.EVENT
        assert len(dialog_paths) == 2
        # `_block()` placed the dialog one level inside the wrapper.
        assert dialog_paths[0] == [*wrapper_paths[0], 0]
        # The re-send from open() must target the dialog block, not the wrapper.
        assert dialog_paths[-1] == dialog_paths[0]
