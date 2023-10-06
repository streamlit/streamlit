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

import ast
import hashlib
import inspect
import pathlib
import tempfile
import textwrap
import traceback
from typing import Any, Callable, Sequence
from unittest.mock import MagicMock

from streamlit import source_util, util
from streamlit.proto.WidgetStates_pb2 import WidgetStates
from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.state.session_state import SessionState
from streamlit.testing.v1.element_tree import (
    Block,
    Button,
    Caption,
    Checkbox,
    Code,
    ColorPicker,
    Dataframe,
    DateInput,
    Divider,
    ElementList,
    ElementTree,
    Exception,
    Header,
    Latex,
    Markdown,
    Multiselect,
    Node,
    NumberInput,
    Radio,
    Selectbox,
    SelectSlider,
    Slider,
    Subheader,
    Text,
    TextArea,
    TextInput,
    TimeInput,
    Title,
    WidgetList,
)
from streamlit.testing.v1.local_script_runner import LocalScriptRunner
from streamlit.testing.v1.util import patch_config_options
from streamlit.web.bootstrap import _fix_matplotlib_crash

TMP_DIR = tempfile.TemporaryDirectory()

_fix_matplotlib_crash()


class AppTest:
    def __init__(self, script_path: str, *, default_timeout: float):
        self._script_path = script_path
        self.default_timeout = default_timeout
        self.session_state = SessionState()
        self.query_params: dict[str, Any] = {}

        tree = ElementTree()
        tree._runner = self
        self._tree = tree

    @classmethod
    def from_string(cls, script: str, *, default_timeout: float = 3) -> AppTest:
        """Create a runner for a script with the contents from a string.

        Useful for testing short scripts that fit comfortably as an inline
        string in the test itself, without having to create a separate file
        for it.

        Parameters
        ----------
        script
            The string contents of the script to be run.

        default_timeout
            Default time in seconds before a script run is timed out. Can be
            overridden for individual `.run()` calls.

        """
        hasher = hashlib.md5(bytes(script, "utf-8"))
        script_name = hasher.hexdigest()

        path = pathlib.Path(TMP_DIR.name, script_name)
        aligned_script = textwrap.dedent(script)
        path.write_text(aligned_script)
        return AppTest(str(path), default_timeout=default_timeout)

    @classmethod
    def from_function(
        cls, script: Callable[[], None], *, default_timeout: float = 3
    ) -> AppTest:
        """Create a runner for a script with the contents from a function.

        Similar to `AppTest.from_string()`, but more convenient to write
        with IDE assistance.

        Parameters
        ----------
        script
            A function whose body will be used as a script. Must be runnable
            in isolation, so it must include any used imports.

        default_timeout
            Default time in seconds before a script run is timed out. Can be
            overridden for individual `.run()` calls.

        """
        # TODO: Simplify this using `ast.unparse()` once we drop 3.8 support
        source_lines, _ = inspect.getsourcelines(script)
        source = textwrap.dedent("".join(source_lines))
        module = ast.parse(source)
        fn_def = module.body[0]
        body_lines = source_lines[fn_def.lineno :]
        body = textwrap.dedent("".join(body_lines))
        return cls.from_string(body, default_timeout=default_timeout)

    @classmethod
    def from_file(cls, script_path: str, *, default_timeout: float = 3) -> AppTest:
        """Create a runner for the script with the given file name.

        Parameters
        ----------
        script_path
            Path to a script file. Several locations are tried, including treating
            the path as relative to the file calling `.from_file`.

        default_timeout
            Default time in seconds before a script run is timed out. Can be
            overridden for individual `.run()` calls.
        """
        if pathlib.Path.is_file(pathlib.Path(script_path)):
            path = script_path
        else:
            # TODO: Make this not super fragile
            # Attempt to find the test file calling this method, so the
            # path can be relative to there.
            stack = traceback.StackSummary.extract(traceback.walk_stack(None))
            filepath = pathlib.Path(stack[1].filename)
            path = str(filepath.parent / script_path)
        return AppTest(path, default_timeout=default_timeout)

    def _run(
        self,
        widget_state: WidgetStates | None = None,
        timeout: float | None = None,
    ) -> AppTest:
        """Run the script, and parse the output messages for querying
        and interaction.

        Timeout is in seconds, or None to use the default timeout of the runner.
        """
        if timeout is None:
            timeout = self.default_timeout

        # setup
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.media_file_mgr = MediaFileManager(
            MemoryMediaFileStorage("/mock/media")
        )
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime
        with source_util._pages_cache_lock:
            self.saved_cached_pages = source_util._cached_pages
            source_util._cached_pages = None

        with patch_config_options({"runner.postScriptGC": False}):
            script_runner = LocalScriptRunner(self._script_path, self.session_state)
            self._tree = script_runner.run(widget_state, self.query_params, timeout)
            self._tree._runner = self

        # teardown
        with source_util._pages_cache_lock:
            source_util._cached_pages = self.saved_cached_pages
        Runtime._instance = None

        return self

    def run(self, *, timeout: float | None = None) -> AppTest:
        """Run the script, and parse the output messages for querying
        and interaction.

        Timeout is in seconds, or None to use the default timeout of the runner.

        Parameters
        ----------
        timeout
            The maximum number of seconds to run the script. None means
            use the AppTest's default.
        """
        return self._tree.run(timeout=timeout)

    @property
    def main(self) -> Block:
        return self._tree.main

    @property
    def sidebar(self) -> Block:
        return self._tree.sidebar

    @property
    def button(self) -> WidgetList[Button]:
        return self._tree.button

    @property
    def caption(self) -> ElementList[Caption]:
        return self._tree.caption

    @property
    def checkbox(self) -> WidgetList[Checkbox]:
        return self._tree.checkbox

    @property
    def code(self) -> ElementList[Code]:
        return self._tree.code

    @property
    def color_picker(self) -> WidgetList[ColorPicker]:
        return self._tree.color_picker

    @property
    def dataframe(self) -> ElementList[Dataframe]:
        return self._tree.dataframe

    @property
    def date_input(self) -> WidgetList[DateInput]:
        return self._tree.date_input

    @property
    def divider(self) -> ElementList[Divider]:
        return self._tree.divider

    @property
    def exception(self) -> ElementList[Exception]:
        return self._tree.exception

    @property
    def header(self) -> ElementList[Header]:
        return self._tree.header

    @property
    def latex(self) -> ElementList[Latex]:
        return self._tree.latex

    @property
    def markdown(self) -> ElementList[Markdown]:
        return self._tree.markdown

    @property
    def multiselect(self) -> WidgetList[Multiselect[Any]]:
        return self._tree.multiselect

    @property
    def number_input(self) -> WidgetList[NumberInput]:
        return self._tree.number_input

    @property
    def radio(self) -> WidgetList[Radio[Any]]:
        return self._tree.radio

    @property
    def select_slider(self) -> WidgetList[SelectSlider[Any]]:
        return self._tree.select_slider

    @property
    def selectbox(self) -> WidgetList[Selectbox[Any]]:
        return self._tree.selectbox

    @property
    def slider(self) -> WidgetList[Slider[Any]]:
        return self._tree.slider

    @property
    def subheader(self) -> ElementList[Subheader]:
        return self._tree.subheader

    @property
    def text(self) -> ElementList[Text]:
        return self._tree.text

    @property
    def text_area(self) -> WidgetList[TextArea]:
        return self._tree.text_area

    @property
    def text_input(self) -> WidgetList[TextInput]:
        return self._tree.text_input

    @property
    def time_input(self) -> WidgetList[TimeInput]:
        return self._tree.time_input

    @property
    def title(self) -> ElementList[Title]:
        return self._tree.title

    def __len__(self) -> int:
        return len(self._tree)

    def __iter__(self):
        yield from self._tree

    def __getitem__(self, idx: int) -> Node:
        return self._tree[idx]

    def get(self, element_type: str) -> Sequence[Node]:
        return self._tree.get(element_type)

    def __repr__(self) -> str:
        return util.repr_(self)
