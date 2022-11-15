# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from unittest.mock import MagicMock, patch

import pytest
from tornado.testing import AsyncTestCase

from streamlit.proto.Block_pb2 import Block as BlockProto
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.Delta_pb2 import Delta
from streamlit.proto.Element_pb2 import Element as ElementProto
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.forward_msg_queue import ForwardMsgQueue
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.scriptrunner import RerunData
from tests.interactive_scripts import (
    Block,
    TestScriptRunner,
    _create_widget,
    parse_tree_from_messages,
    require_widgets_deltas,
)


# TODO wrangle pytest tmp_path fixture to generate a tmp script location
@patch("streamlit.source_util._cached_pages", new=None)
class InteractiveScriptTest(AsyncTestCase):
    def setUp(self) -> None:
        super().setUp()
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.media_file_mgr = MediaFileManager(
            MemoryMediaFileStorage("/mock/media")
        )
        Runtime._instance = mock_runtime

    def tearDown(self) -> None:
        super().tearDown()
        Runtime._instance = None

    def test_widgets_script(self):
        scriptrunner = TestScriptRunner("widgets_script.py")
        scriptrunner.request_rerun(RerunData())
        scriptrunner.start()

        require_widgets_deltas([scriptrunner])

        tree = parse_tree_from_messages(scriptrunner.forward_msgs())

        # main and sidebar
        assert len(tree) == 2
        main = tree.children[0]

        # columns live within a horizontal block, + 2 more elements
        assert len(main) == 3

        # 2 columns
        assert len(main.children[0]) == 2

        # first column has 4 elements
        assert len(main.children[0].children[0]) == 4

        print([e.value for e in tree.get("text")])
        print([e.value for e in tree.get("radio")])

        radios = tree.get("radio")
        assert radios[0].value == "1"
        assert radios[1].value == "a"

        assert False
