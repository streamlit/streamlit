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
import pathlib
import unittest
from unittest.mock import MagicMock, patch

import pytest

from streamlit.runtime import Runtime
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from tests.interactive_scripts import script_from_filename, script_from_string


@pytest.fixture(scope="class")
def tmp_script_path(request, tmp_path_factory):
    tmp_path: pathlib.Path = tmp_path_factory.mktemp("test_data")
    tmp_path.mkdir(exist_ok=True, parents=True)
    request.cls.script_dir = tmp_path


@patch("streamlit.source_util._cached_pages", new=None)
@pytest.mark.usefixtures("tmp_script_path")
class InteractiveScriptTest(unittest.TestCase):
    script_dir: pathlib.Path

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
        script = script_from_filename("widgets_script.py")
        sr = script.run()

        # main and sidebar
        assert len(sr) == 2
        main = sr.children[0]

        # columns live within a horizontal block, + 2 more elements
        assert len(main) == 3

        # 2 columns
        assert len(main[0]) == 2

        # first column has 4 elements
        assert len(main[0][0]) == 4

        radios = sr.get("radio")
        assert radios[0].value == "1"
        assert radios[1].value == "a"

        # iteration follows delta path order, with a block coming before
        # its children, which come before its siblings. main comes before
        # the sidebar
        assert [e.type for e in sr] == [
            "root",
            "main",
            "horizontal",
            "column",
            "checkbox",
            "text",
            "text_area",
            "text",
            "column",
            "radio",
            "text",
            "button",
            "text",
            "sidebar",
            "radio",
        ]

    def test_cached_widget_replay_rerun(self):
        script = script_from_string(
            self.script_dir / "cached_widget_replay.py",
            """
import streamlit as st

@st.experimental_memo(experimental_allow_widgets=True)
def foo(i):
    options = ["foo", "bar", "baz", "qux"]
    r = st.radio("radio", options, index=i)
    return r


r = foo(1)
st.text(r)
        """,
        )
        sr = script.run()

        assert len(sr.get("radio")) == 1
        sr2 = sr.run()
        assert len(sr2.get("radio")) == 1

    def test_cached_widget_replay_interaction(self):
        script = script_from_string(
            self.script_dir / "cached_widget_replay.py",
            """
import streamlit as st

@st.experimental_memo(experimental_allow_widgets=True)
def foo(i):
    options = ["foo", "bar", "baz", "qux"]
    r = st.radio("radio", options, index=i)
    return r


r = foo(1)
st.text(r)
        """,
        )
        sr = script.run()

        assert len(sr.get("radio")) == 1
        assert sr.get("text")[0].value == "bar"

        sr2 = sr.get("radio")[0].set_value("qux").run()
        assert sr2.get("text")[0].value == "qux"

    def test_radio_interaction(self):
        script = script_from_string(
            self.script_dir / "radio_interaction.py",
            """
import streamlit as st

r1 = st.radio("radio", options=["a", "b", "c"])
st.text(r1)
r2 = st.radio("default index", options=["a", "b", "c"], index=2)
st.text(r2)
            """,
        )
        sr = script.run()
        assert sr.get("radio")
        assert sr.get("radio")[0].value == "a"
        assert sr.get("radio")[1].value == "c"
        assert [t.value for t in sr.get("text")] == ["a", "c"]

        r = sr.get("radio")[0].set_value("b")
        assert r._index == 1
        sr2 = r.run()
        # assert sr2.get("radio")[0].value == "b"
        assert [t.value for t in sr2.get("text")] == ["b", "c"]
