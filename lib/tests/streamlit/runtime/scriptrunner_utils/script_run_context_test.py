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

import threading
import unittest
from typing import Callable

import pytest
from parameterized import parameterized

from streamlit.errors import NoSessionContext, StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.forward_msg_cache import populate_hash_if_needed
from streamlit.runtime.fragment import MemoryFragmentStorage
from streamlit.runtime.memory_uploaded_file_manager import MemoryUploadedFileManager
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    SCRIPT_RUN_CONTEXT_ATTR_NAME,
    ScriptRunContext,
    add_script_run_ctx,
    enqueue_message,
)
from streamlit.runtime.state import SafeSessionState, SessionState
from streamlit.testing.v1.util import patch_config_options
from tests.streamlit.message_mocks import create_dataframe_msg


def _create_script_run_context(
    fake_enqueue: Callable[[ForwardMsg], None],
    current_fragment_id: str | None = None,
    pages_manager: PagesManager | None = None,
    cached_message_hashes: set[str] | None = None,
):
    return ScriptRunContext(
        session_id="TestSessionID",
        _enqueue=fake_enqueue,
        query_string="",
        session_state=SafeSessionState(SessionState(), lambda: None),
        uploaded_file_mgr=MemoryUploadedFileManager("/mock/upload"),
        main_script_path="",
        user_info={"email": "test@example.com"},
        fragment_storage=MemoryFragmentStorage(),
        pages_manager=pages_manager or PagesManager(""),
        current_fragment_id=current_fragment_id,
        cached_message_hashes=cached_message_hashes or set(),
    )


class ScriptRunContextTest(unittest.TestCase):
    def setUp(self):
        try:
            # clear context variable as it otherwise would be carried over between tests
            delattr(threading.current_thread(), SCRIPT_RUN_CONTEXT_ATTR_NAME)
        except AttributeError:
            pass

    def test_allow_set_page_config_once(self):
        """st.set_page_config can be called once"""

        def fake_enqueue(msg):
            return None

        ctx = _create_script_run_context(fake_enqueue)

        msg = ForwardMsg()
        msg.page_config_changed.title = "foo"
        ctx.enqueue(msg)

    def test_allow_set_page_config_twice(self):
        """st.set_page_config can be called twice"""

        def fake_enqueue(msg):
            return None

        ctx = _create_script_run_context(fake_enqueue)

        msg = ForwardMsg()
        msg.page_config_changed.title = "foo"
        ctx.enqueue(msg)

        same_msg = ForwardMsg()
        same_msg.page_config_changed.title = "bar"
        ctx.enqueue(same_msg)

    def test_active_script_hash(self):
        """ensures active script hash is set correctly when enqueueing messages"""

        fake_path = "my/custom/script/path"
        pg_mgr = PagesManager(fake_path)

        def fake_enqueue(msg):
            return None

        ctx = _create_script_run_context(fake_enqueue, pages_manager=pg_mgr)
        ctx.reset(page_script_hash="main_script_hash")

        ctx.on_script_start()

        msg = ForwardMsg()
        msg.delta.new_element.markdown.body = "foo"

        ctx.enqueue(msg)
        assert msg.metadata.active_script_hash == ctx.active_script_hash

        ctx.set_mpa_v2_page("new_hash")

        with ctx.run_with_active_hash("new_hash"):
            new_msg = ForwardMsg()
            new_msg.delta.new_element.markdown.body = "bar"

            ctx.enqueue(new_msg)
            assert new_msg.metadata.active_script_hash == "new_hash"

    @parameterized.expand(
        [
            (True, True, True),  # Both APIs used
            (True, False, False),  # Only experimental API used
            (False, True, False),  # Only final API used
            (False, False, False),  # Neither API used
        ]
    )
    def test_both_query_params_used(
        self, experimental_used, production_used, should_raise
    ):
        def fake_enqueue(msg):
            return None

        ctx = _create_script_run_context(fake_enqueue)
        ctx._experimental_query_params_used = experimental_used
        ctx._production_query_params_used = production_used

        if should_raise:
            with pytest.raises(StreamlitAPIException):
                ctx.ensure_single_query_api_used()
        else:
            ctx.ensure_single_query_api_used()

    def test_mark_experimental_query_params_used_sets_true(self):
        def fake_enqueue(msg):
            return None

        ctx = _create_script_run_context(fake_enqueue)
        ctx.mark_experimental_query_params_used()
        assert ctx._experimental_query_params_used is True

    def test_mark_production_query_params_used_sets_true(self):
        def fake_enqueue(msg):
            return None

        ctx = _create_script_run_context(fake_enqueue)
        ctx.mark_production_query_params_used()
        assert ctx._production_query_params_used is True

    def test_enqueue_message_raise_if_ctx_is_none(self):
        msg = ForwardMsg()
        msg.delta.new_element.markdown.body = "foo"

        with pytest.raises(NoSessionContext):
            enqueue_message(msg)

    def test_enqueue_message(self):
        fake_enqueue_result: dict[str, ForwardMsg] = {}

        def fake_enqueue(msg: ForwardMsg):
            fake_enqueue_result["msg"] = msg

        ctx = _create_script_run_context(fake_enqueue)
        add_script_run_ctx(ctx=ctx)
        msg = ForwardMsg()
        msg.delta.new_element.markdown.body = "foo"
        enqueue_message(msg)
        assert fake_enqueue_result is not None
        assert (
            fake_enqueue_result["msg"].delta.new_element.markdown.body
            == msg.delta.new_element.markdown.body
        )

    def test_enqueue_message_sets_cacheable_flag(self):
        """Test that the metadata.cacheable flag is set correctly on outgoing ForwardMsgs."""
        fake_enqueue_result: dict[str, ForwardMsg] = {}

        def fake_enqueue(msg: ForwardMsg):
            fake_enqueue_result["msg"] = msg

        ctx = _create_script_run_context(fake_enqueue)
        add_script_run_ctx(ctx=ctx)

        with patch_config_options({"global.minCachedMessageSize": 0}):
            cacheable_msg = create_dataframe_msg([1, 2, 3])
            enqueue_message(cacheable_msg)
            assert fake_enqueue_result is not None
            assert fake_enqueue_result["msg"].metadata.cacheable

        with patch_config_options({"global.minCachedMessageSize": 1000}):
            cacheable_msg = create_dataframe_msg([4, 5, 6])
            enqueue_message(cacheable_msg)
            assert fake_enqueue_result is not None
            assert not fake_enqueue_result["msg"].metadata.cacheable

    def test_enqueue_reference_message_if_cached(self):
        """Test that a reference message is enqueued if the original message is cached."""
        fake_enqueue_result: dict[str, ForwardMsg] = {}

        def fake_enqueue(msg: ForwardMsg):
            fake_enqueue_result["msg"] = msg

        with patch_config_options({"global.minCachedMessageSize": 0}):
            cacheable_msg = create_dataframe_msg([1, 2, 3])
            populate_hash_if_needed(cacheable_msg)
            assert bool(cacheable_msg.hash)
            ctx = _create_script_run_context(
                fake_enqueue, cached_message_hashes={cacheable_msg.hash}
            )
            add_script_run_ctx(ctx=ctx)
            enqueue_message(cacheable_msg)
            assert fake_enqueue_result is not None
            assert fake_enqueue_result["msg"].WhichOneof("type") == "ref_hash"

    def test_enqueue_message_with_fragment_id(self):
        fake_enqueue_result = {}

        def fake_enqueue(msg: ForwardMsg):
            fake_enqueue_result["msg"] = msg

            ctx = _create_script_run_context(
                fake_enqueue, current_fragment_id="my_fragment_id"
            )
            add_script_run_ctx(ctx=ctx)
            msg = ForwardMsg()
            msg.delta.new_element.markdown.body = "foo"
            enqueue_message(msg)
            assert fake_enqueue_result is not None
            assert (
                fake_enqueue_result["msg"].delta.new_element.markdown.body
                == msg.delta.new_element.markdown.body
            )
            assert fake_enqueue_result["msg"].delta.fragment_id == "my_fragment_id"

    def test_run_with_active_hash(self):
        """Ensure the active script is set correctly"""
        pages_manager = PagesManager("")
        ctx = _create_script_run_context(
            lambda _msg: None,
            current_fragment_id="my_fragment_id",
            pages_manager=pages_manager,
        )

        ctx.reset(page_script_hash=pages_manager.main_script_hash)
        assert ctx.active_script_hash == pages_manager.main_script_hash

        pages_manager.set_pages({})
        ctx.set_mpa_v2_page("new_hash")
        assert ctx.active_script_hash == pages_manager.main_script_hash

        with ctx.run_with_active_hash("new_hash"):
            assert ctx.active_script_hash == "new_hash"

        assert ctx.active_script_hash == pages_manager.main_script_hash
