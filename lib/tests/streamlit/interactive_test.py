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

from tornado.testing import AsyncTestCase

from streamlit.runtime import Runtime
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from tests.interactive_scripts import TestScriptRunner


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
        tree = scriptrunner.run()

        # main and sidebar
        assert len(tree) == 2
        main = tree.children[0]

        # columns live within a horizontal block, + 2 more elements
        assert len(main) == 3

        # 2 columns
        assert len(main.children[0]) == 2

        # first column has 4 elements
        assert len(main.children[0].children[0]) == 4

        radios = tree.get("radio")
        assert radios[0].value == "1"
        assert radios[1].value == "a"

        tree.get_widget_states()

    def test_cached_widget_replay_rerun(self):
        scriptrunner = TestScriptRunner("cached_widget_replay.py")
        sr = scriptrunner.run()

        assert len(sr.get("radio")) == 1
        # sr2 = sr.get("button")[0].click().run()
        sr2 = sr.run()
        assert len(sr2.get("radio")) == 1

    def test_cached_widget_replay_interaction(self):
        scriptrunner = TestScriptRunner("cached_widget_replay.py")
        sr = scriptrunner.run()

        assert len(sr.get("radio")) == 1
        assert sr.get("text")[0].value == "bar"

        sr2 = sr.get("radio")[0].set_value("qux").run()
        assert sr2.get("text")[0].value == "qux"
