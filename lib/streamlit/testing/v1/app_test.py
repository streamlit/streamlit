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
from __future__ import annotations

import hashlib
import inspect
import tempfile
import textwrap
import traceback
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Sequence
from unittest.mock import MagicMock
from urllib import parse

from streamlit import source_util
from streamlit.runtime import Runtime
from streamlit.runtime.caching.storage.dummy_cache_storage import (
    MemoryCacheStorageManager,
)
from streamlit.runtime.media_file_manager import MediaFileManager
from streamlit.runtime.memory_media_file_storage import MemoryMediaFileStorage
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.secrets import Secrets
from streamlit.runtime.state.common import TESTING_KEY
from streamlit.runtime.state.safe_session_state import SafeSessionState
from streamlit.runtime.state.session_state import SessionState
from streamlit.testing.v1.element_tree import (
    Block,
    Button,
    Caption,
    ChatInput,
    ChatMessage,
    Checkbox,
    Code,
    ColorPicker,
    Column,
    Dataframe,
    DateInput,
    Divider,
    ElementList,
    ElementTree,
    Error,
    Exception,
    Expander,
    Header,
    Info,
    Json,
    Latex,
    Markdown,
    Metric,
    Multiselect,
    Node,
    NumberInput,
    Radio,
    Selectbox,
    SelectSlider,
    Slider,
    Status,
    Subheader,
    Success,
    Tab,
    Table,
    Text,
    TextArea,
    TextInput,
    TimeInput,
    Title,
    Toast,
    Toggle,
    Warning,
    WidgetList,
    repr_,
)
from streamlit.testing.v1.local_script_runner import LocalScriptRunner
from streamlit.testing.v1.util import patch_config_options
from streamlit.util import HASHLIB_KWARGS, calc_md5

if TYPE_CHECKING:
    from streamlit.proto.WidgetStates_pb2 import WidgetStates

TMP_DIR = tempfile.TemporaryDirectory()


class AppTest:
    """
    A simulated Streamlit app to check the correctness of displayed\
    elements and outputs.

    An instance of ``AppTest`` simulates a running Streamlit app. This class
    provides methods to set up, manipulate, and inspect the app contents via
    API instead of a browser UI. It can be used to write automated tests of an
    app in various scenarios. These can then be run using a tool like pytest.

    ``AppTest`` can be initialized by one of three class methods:

    * |st.testing.v1.AppTest.from_file|_ (recommended)
    * |st.testing.v1.AppTest.from_string|_
    * |st.testing.v1.AppTest.from_function|_

    Once initialized, Session State and widget values can be updated and the
    script can be run. Unlike an actual live-running Streamlit app, you need to
    call ``AppTest.run()`` explicitly to re-run the app after changing a widget
    value. Switching pages also requires an explicit, follow-up call to
    ``AppTest.run()``.

    ``AppTest`` enables developers to build tests on their app as-is, in the
    familiar python test format, without major refactoring or abstracting out
    logic to be tested separately from the UI. Tests can run quickly with very
    low overhead. A typical pattern is to build a suite of tests for an app
    that ensure consistent functionality as the app evolves, and run the tests
    locally and/or in a CI environment like Github Actions.

    .. note::
        ``AppTest`` only supports testing a single page of an app per
        instance. For multipage apps, each page will need to be tested
        separately. No methods exist to programatically switch pages within
        ``AppTest``.

    .. |st.testing.v1.AppTest.from_file| replace:: ``st.testing.v1.AppTest.from_file``
    .. _st.testing.v1.AppTest.from_file: #apptestfrom_file
    .. |st.testing.v1.AppTest.from_string| replace:: ``st.testing.v1.AppTest.from_string``
    .. _st.testing.v1.AppTest.from_string: #apptestfrom_string
    .. |st.testing.v1.AppTest.from_function| replace:: ``st.testing.v1.AppTest.from_function``
    .. _st.testing.v1.AppTest.from_function: #apptestfrom_function

    Attributes
    ----------
    secrets: dict[str, Any]
        Dictionary of secrets to be used the simulated app. Use dict-like
        syntax to set secret values for the simulated app.

    session_state: SafeSessionState
        Session State for the simulated app. SafeSessionState object supports
        read and write operations as usual for Streamlit apps.

    query_params: dict[str, Any]
        Dictionary of query parameters to be used by the simluated app. Use
        dict-like syntax to set ``query_params`` values for the simulated app.
    """

    def __init__(
        self,
        script_path: str,
        *,
        default_timeout: float,
        args=None,
        kwargs=None,
    ):
        self._script_path = script_path
        self.default_timeout = default_timeout
        session_state = SessionState()
        session_state[TESTING_KEY] = {}
        self.session_state = SafeSessionState(session_state, lambda: None)
        self.query_params: dict[str, Any] = {}
        self.secrets: dict[str, Any] = {}
        self.args = args
        self.kwargs = kwargs
        self._page_hash = ""

        tree = ElementTree()
        tree._runner = self
        self._tree = tree

    @classmethod
    def from_string(cls, script: str, *, default_timeout: float = 3) -> AppTest:
        """
        Create an instance of ``AppTest`` to simulate an app page defined\
        within a string.

        This is useful for testing short scripts that fit comfortably as an
        inline string in the test itself, without having to create a separate
        file for it. The script must be executable on its own and so must
        contain all necessary imports.

        Parameters
        ----------
        script: str
            The string contents of the script to be run.

        default_timeout: float
            Default time in seconds before a script run is timed out. Can be
            overridden for individual ``.run()`` calls.

        Returns
        -------
        AppTest
            A simulated Streamlit app for testing. The simulated app can be
            executed via ``.run()``.

        """
        return cls._from_string(script, default_timeout=default_timeout)

    @classmethod
    def _from_string(
        cls, script: str, *, default_timeout: float = 3, args=None, kwargs=None
    ) -> AppTest:
        hasher = hashlib.md5(bytes(script, "utf-8"), **HASHLIB_KWARGS)
        script_name = hasher.hexdigest()

        path = Path(TMP_DIR.name, script_name)
        aligned_script = textwrap.dedent(script)
        path.write_text(aligned_script)
        return AppTest(
            str(path), default_timeout=default_timeout, args=args, kwargs=kwargs
        )

    @classmethod
    def from_function(
        cls,
        script: Callable[..., Any],
        *,
        default_timeout: float = 3,
        args=None,
        kwargs=None,
    ) -> AppTest:
        """
        Create an instance of ``AppTest`` to simulate an app page defined\
        within a function.

        This is similar to ``AppTest.from_string()``, but more convenient to
        write with IDE assistance. The script must be executable on its own and
        so must contain all necessary imports.

        Parameters
        ----------
        script: Callable
            A function whose body will be used as a script. Must be runnable
            in isolation, so it must include any necessary imports.

        default_timeout: float
            Default time in seconds before a script run is timed out. Can be
            overridden for individual ``.run()`` calls.

        args: tuple
            An optional tuple of args to pass to the script function.

        kwargs: dict
            An optional dict of kwargs to pass to the script function.

        Returns
        -------
        AppTest
            A simulated Streamlit app for testing. The simulated app can be
            executed via ``.run()``.

        """
        source_lines, _ = inspect.getsourcelines(script)
        source = textwrap.dedent("".join(source_lines))
        module = source + f"\n{script.__name__}(*__args, **__kwargs)"
        return cls._from_string(
            module, default_timeout=default_timeout, args=args, kwargs=kwargs
        )

    @classmethod
    def from_file(cls, script_path: str, *, default_timeout: float = 3) -> AppTest:
        """
        Create an instance of ``AppTest`` to simulate an app page defined\
        within a file.

        This option is most convenient for CI workflows and testing of
        published apps. The script must be executable on its own and so must
        contain all necessary imports.

        Parameters
        ----------
        script_path: str
            Path to a script file. The path should be absolute or relative to
            the file calling ``.from_file``.

        default_timeout: float
            Default time in seconds before a script run is timed out. Can be
            overridden for individual ``.run()`` calls.

        Returns
        -------
        AppTest
            A simulated Streamlit app for testing. The simulated app can be
            executed via ``.run()``.

        """
        if Path.is_file(Path(script_path)):
            path = script_path
        else:
            # TODO: Make this not super fragile
            # Attempt to find the test file calling this method, so the
            # path can be relative to there.
            stack = traceback.StackSummary.extract(traceback.walk_stack(None))
            filepath = Path(stack[1].filename)
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
        # Have to import the streamlit module itself so replacing st.secrets
        # is visible to other modules.
        import streamlit as st

        if timeout is None:
            timeout = self.default_timeout

        # setup
        mock_runtime = MagicMock(spec=Runtime)
        mock_runtime.media_file_mgr = MediaFileManager(
            MemoryMediaFileStorage("/mock/media")
        )
        mock_runtime.cache_storage_manager = MemoryCacheStorageManager()
        Runtime._instance = mock_runtime
        pages_manager = PagesManager(self._script_path, setup_watcher=False)
        with source_util._pages_cache_lock:
            saved_cached_pages = source_util._cached_pages
            source_util._cached_pages = None

        saved_secrets: Secrets = st.secrets
        # Only modify global secrets stuff if we have been given secrets
        if self.secrets:
            new_secrets = Secrets([])
            new_secrets._secrets = self.secrets
            st.secrets = new_secrets

        script_runner = LocalScriptRunner(
            self._script_path,
            self.session_state,
            pages_manager,
            args=self.args,
            kwargs=self.kwargs,
        )
        with patch_config_options({"global.appTest": True}):
            self._tree = script_runner.run(
                widget_state, self.query_params, timeout, self._page_hash
            )
            self._tree._runner = self
        # Last event is SHUTDOWN, so the corresponding data includes query string
        query_string = script_runner.event_data[-1]["client_state"].query_string
        self.query_params = parse.parse_qs(query_string)

        # teardown
        with source_util._pages_cache_lock:
            source_util._cached_pages = saved_cached_pages

        if self.secrets:
            if st.secrets._secrets is not None:
                self.secrets = dict(st.secrets._secrets)
            st.secrets = saved_secrets
        Runtime._instance = None

        return self

    def run(self, *, timeout: float | None = None) -> AppTest:
        """Run the script from the current state.

        This is equivalent to manually rerunning the app or the rerun that
        occurs upon user interaction. ``AppTest.run()`` must be manually called
        after updating a widget value or switching pages as script reruns do
        not occur automatically as they do for live-running Streamlit apps.

        Parameters
        ----------
        timeout : float or None
            The maximum number of seconds to run the script. If ``timeout`` is
            ``None`` (default), Streamlit uses the default timeout set for the
            instance of ``AppTest``.

        Returns
        -------
        AppTest
            self

        """
        return self._tree.run(timeout=timeout)

    def switch_page(self, page_path: str) -> AppTest:
        """Switch to another page of the app.

        This method does not automatically rerun the app. Use a follow-up call
        to ``AppTest.run()`` to obtain the elements on the selected page.

        Parameters
        ----------
        page_path: str
            Path of the page to switch to. The path must be relative to the
            main script's location (e.g. ``"pages/my_page.py"``).

        Returns
        -------
        AppTest
            self

        """
        main_dir = Path(self._script_path).parent
        full_page_path = main_dir / page_path
        if not full_page_path.is_file():
            raise ValueError(
                f"Unable to find script at {page_path}, make sure the page given is relative to the main script."
            )
        page_path_str = str(full_page_path.resolve())
        self._page_hash = calc_md5(page_path_str)
        return self

    @property
    def main(self) -> Block:
        """Sequence of elements within the main body of the app.

        Returns
        -------
        Block
            A container of elements. Block can be queried for elements in the
            same manner as ``AppTest``. For example, ``Block.checkbox`` will
            return all ``st.checkbox`` within the associated container.
        """
        return self._tree.main

    @property
    def sidebar(self) -> Block:
        """Sequence of all elements within ``st.sidebar``.

        Returns
        -------
        Block
            A container of elements. Block can be queried for elements in the
            same manner as ``AppTest``. For example, ``Block.checkbox`` will
            return all ``st.checkbox`` within the associated container.
        """
        return self._tree.sidebar

    @property
    def button(self) -> WidgetList[Button]:
        """Sequence of all ``st.button`` and ``st.form_submit_button`` widgets.

        Returns
        -------
        WidgetList of Button
            Sequence of all ``st.button`` and ``st.form_submit_button``
            widgets. Individual widgets can be accessed from a WidgetList by
            index (order on the page) or key. For example, ``at.button[0]`` for
            the first widget or ``at.button(key="my_key")`` for a widget with a
            given key.
        """
        return self._tree.button

    @property
    def caption(self) -> ElementList[Caption]:
        """Sequence of all ``st.caption`` elements.

        Returns
        -------
        ElementList of Caption
            Sequence of all ``st.caption`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.caption[0]`` for the first element. Caption is an
            extension of the Element class.
        """
        return self._tree.caption

    @property
    def chat_input(self) -> WidgetList[ChatInput]:
        """Sequence of all ``st.chat_input`` widgets.

        Returns
        -------
        WidgetList of ChatInput
            Sequence of all ``st.chat_input`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.chat_input[0]`` for the first widget or
            ``at.chat_input(key="my_key")`` for a widget with a given key.
        """
        return self._tree.chat_input

    @property
    def chat_message(self) -> Sequence[ChatMessage]:
        """Sequence of all ``st.chat_message`` elements.

        Returns
        -------
        Sequence of ChatMessage
            Sequence of all ``st.chat_message`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.chat_message[0]`` for the first element.  ChatMessage
            is an extension of the Block class.
        """
        return self._tree.chat_message

    @property
    def checkbox(self) -> WidgetList[Checkbox]:
        """Sequence of all ``st.checkbox`` widgets.

        Returns
        -------
        WidgetList of Checkbox
            Sequence of all ``st.checkbox`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.checkbox[0]`` for the first widget or
            ``at.checkbox(key="my_key")`` for a widget with a given key.
        """
        return self._tree.checkbox

    @property
    def code(self) -> ElementList[Code]:
        """Sequence of all ``st.code`` elements.

        Returns
        -------
        ElementList of Code
            Sequence of all ``st.code`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.code[0]`` for the first element. Code is an
            extension of the Element class.
        """
        return self._tree.code

    @property
    def color_picker(self) -> WidgetList[ColorPicker]:
        """Sequence of all ``st.color_picker`` widgets.

        Returns
        -------
        WidgetList of ColorPicker
            Sequence of all ``st.color_picker`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.color_picker[0]`` for the first widget or
            ``at.color_picker(key="my_key")`` for a widget with a given key.
        """
        return self._tree.color_picker

    @property
    def columns(self) -> Sequence[Column]:
        """Sequence of all columns within ``st.columns`` elements.

        Each column within a single ``st.columns`` will be returned as a
        separate Column in the Sequence.

        Returns
        -------
        Sequence of Column
            Sequence of all columns within ``st.columns`` elements. Individual
            columns can be accessed from an ElementList by index (order on the
            page). For example, ``at.columns[0]`` for the first column. Column
            is an extension of the Block class.
        """
        return self._tree.columns

    @property
    def dataframe(self) -> ElementList[Dataframe]:
        """Sequence of all ``st.dataframe`` elements.

        Returns
        -------
        ElementList of Dataframe
            Sequence of all ``st.dataframe`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.dataframe[0]`` for the first element. Dataframe is an
            extension of the Element class.
        """
        return self._tree.dataframe

    @property
    def date_input(self) -> WidgetList[DateInput]:
        """Sequence of all ``st.date_input`` widgets.

        Returns
        -------
        WidgetList of DateInput
            Sequence of all ``st.date_input`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.date_input[0]`` for the first widget or
            ``at.date_input(key="my_key")`` for a widget with a given key.
        """
        return self._tree.date_input

    @property
    def divider(self) -> ElementList[Divider]:
        """Sequence of all ``st.divider`` elements.

        Returns
        -------
        ElementList of Divider
            Sequence of all ``st.divider`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.divider[0]`` for the first element. Divider is an
            extension of the Element class.
        """
        return self._tree.divider

    @property
    def error(self) -> ElementList[Error]:
        """Sequence of all ``st.error`` elements.

        Returns
        -------
        ElementList of Error
            Sequence of all ``st.error`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.error[0]`` for the first element. Error is an
            extension of the Element class.
        """
        return self._tree.error

    @property
    def exception(self) -> ElementList[Exception]:
        """Sequence of all ``st.exception`` elements.

        Returns
        -------
        ElementList of Exception
            Sequence of all ``st.exception`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.exception[0]`` for the first element. Exception is an
            extension of the Element class.
        """
        return self._tree.exception

    @property
    def expander(self) -> Sequence[Expander]:
        """Sequence of all ``st.expander`` elements.

        Returns
        -------
        Sequence of Expandable
            Sequence of all ``st.expander`` elements. Individual elements can be
            accessed from a Sequence by index (order on the page). For
            example, ``at.expander[0]`` for the first element. Expandable is an
            extension of the Block class.
        """
        return self._tree.expander

    @property
    def header(self) -> ElementList[Header]:
        """Sequence of all ``st.header`` elements.

        Returns
        -------
        ElementList of Header
            Sequence of all ``st.header`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.header[0]`` for the first element. Header is an
            extension of the Element class.
        """
        return self._tree.header

    @property
    def info(self) -> ElementList[Info]:
        """Sequence of all ``st.info`` elements.

        Returns
        -------
        ElementList of Info
            Sequence of all ``st.info`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.info[0]`` for the first element. Info is an
            extension of the Element class.
        """
        return self._tree.info

    @property
    def json(self) -> ElementList[Json]:
        """Sequence of all ``st.json`` elements.

        Returns
        -------
        ElementList of Json
            Sequence of all ``st.json`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.json[0]`` for the first element. Json is an
            extension of the Element class.
        """
        return self._tree.json

    @property
    def latex(self) -> ElementList[Latex]:
        """Sequence of all ``st.latex`` elements.

        Returns
        -------
        ElementList of Latex
            Sequence of all ``st.latex`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.latex[0]`` for the first element. Latex is an
            extension of the Element class.
        """
        return self._tree.latex

    @property
    def markdown(self) -> ElementList[Markdown]:
        """Sequence of all ``st.markdown`` elements.

        Returns
        -------
        ElementList of Markdown
            Sequence of all ``st.markdown`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.markdown[0]`` for the first element. Markdown is an
            extension of the Element class.
        """
        return self._tree.markdown

    @property
    def metric(self) -> ElementList[Metric]:
        """Sequence of all ``st.metric`` elements.

        Returns
        -------
        ElementList of Metric
            Sequence of all ``st.metric`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.metric[0]`` for the first element. Metric is an
            extension of the Element class.
        """
        return self._tree.metric

    @property
    def multiselect(self) -> WidgetList[Multiselect[Any]]:
        """Sequence of all ``st.multiselect`` widgets.

        Returns
        -------
        WidgetList of Multiselect
            Sequence of all ``st.multiselect`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.multiselect[0]`` for the first widget or
            ``at.multiselect(key="my_key")`` for a widget with a given key.
        """
        return self._tree.multiselect

    @property
    def number_input(self) -> WidgetList[NumberInput]:
        """Sequence of all ``st.number_input`` widgets.

        Returns
        -------
        WidgetList of NumberInput
            Sequence of all ``st.number_input`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.number_input[0]`` for the first widget or
            ``at.number_input(key="my_key")`` for a widget with a given key.
        """
        return self._tree.number_input

    @property
    def radio(self) -> WidgetList[Radio[Any]]:
        """Sequence of all ``st.radio`` widgets.

        Returns
        -------
        WidgetList of Radio
            Sequence of all ``st.radio`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.radio[0]`` for the first widget or
            ``at.radio(key="my_key")`` for a widget with a given key.
        """
        return self._tree.radio

    @property
    def select_slider(self) -> WidgetList[SelectSlider[Any]]:
        """Sequence of all ``st.select_slider`` widgets.

        Returns
        -------
        WidgetList of SelectSlider
            Sequence of all ``st.select_slider`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.select_slider[0]`` for the first widget or
            ``at.select_slider(key="my_key")`` for a widget with a given key.
        """
        return self._tree.select_slider

    @property
    def selectbox(self) -> WidgetList[Selectbox[Any]]:
        """Sequence of all ``st.selectbox`` widgets.

        Returns
        -------
        WidgetList of Selectbox
            Sequence of all ``st.selectbox`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.selectbox[0]`` for the first widget or
            ``at.selectbox(key="my_key")`` for a widget with a given key.
        """
        return self._tree.selectbox

    @property
    def slider(self) -> WidgetList[Slider[Any]]:
        """Sequence of all ``st.slider`` widgets.

        Returns
        -------
        WidgetList of Slider
            Sequence of all ``st.slider`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.slider[0]`` for the first widget or
            ``at.slider(key="my_key")`` for a widget with a given key.
        """
        return self._tree.slider

    @property
    def subheader(self) -> ElementList[Subheader]:
        """Sequence of all ``st.subheader`` elements.

        Returns
        -------
        ElementList of Subheader
            Sequence of all ``st.subheader`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.subheader[0]`` for the first element. Subheader is an
            extension of the Element class.
        """
        return self._tree.subheader

    @property
    def success(self) -> ElementList[Success]:
        """Sequence of all ``st.success`` elements.

        Returns
        -------
        ElementList of Success
            Sequence of all ``st.success`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.success[0]`` for the first element. Success is an
            extension of the Element class.
        """
        return self._tree.success

    @property
    def status(self) -> Sequence[Status]:
        """Sequence of all ``st.status`` elements.

        Returns
        -------
        Sequence of Status
            Sequence of all ``st.status`` elements. Individual elements can be
            accessed from a Sequence by index (order on the page). For
            example, ``at.status[0]`` for the first element. Status is an
            extension of the Block class.
        """
        return self._tree.status

    @property
    def table(self) -> ElementList[Table]:
        """Sequence of all ``st.table`` elements.

        Returns
        -------
        ElementList of Table
            Sequence of all ``st.table`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.table[0]`` for the first element. Table is an
            extension of the Element class.
        """
        return self._tree.table

    @property
    def tabs(self) -> Sequence[Tab]:
        """Sequence of all tabs within ``st.tabs`` elements.

        Each tab within a single ``st.tabs`` will be returned as a separate Tab
        in the Sequence. Additionally, the tab labels are forwarded to each
        Tab element as a property. For example, ``st.tabs("A","B")`` will
        yield two Tab objects, with ``Tab.label`` returning "A" and "B",
        respectively.

        Returns
        -------
        Sequence of Tab
            Sequence of all tabs within ``st.tabs`` elements. Individual
            tabs can be accessed from an ElementList by index (order on the
            page). For example, ``at.tabs[0]`` for the first tab. Tab is an
            extension of the Block class.
        """
        return self._tree.tabs

    @property
    def text(self) -> ElementList[Text]:
        """Sequence of all ``st.text`` elements.

        Returns
        -------
        ElementList of Text
            Sequence of all ``st.text`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.text[0]`` for the first element. Text is an
            extension of the Element class.
        """
        return self._tree.text

    @property
    def text_area(self) -> WidgetList[TextArea]:
        """Sequence of all ``st.text_area`` widgets.

        Returns
        -------
        WidgetList of TextArea
            Sequence of all ``st.text_area`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.text_area[0]`` for the first widget or
            ``at.text_area(key="my_key")`` for a widget with a given key.
        """
        return self._tree.text_area

    @property
    def text_input(self) -> WidgetList[TextInput]:
        """Sequence of all ``st.text_input`` widgets.

        Returns
        -------
        WidgetList of TextInput
            Sequence of all ``st.text_input`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.text_input[0]`` for the first widget or
            ``at.text_input(key="my_key")`` for a widget with a given key.
        """
        return self._tree.text_input

    @property
    def time_input(self) -> WidgetList[TimeInput]:
        """Sequence of all ``st.time_input`` widgets.

        Returns
        -------
        WidgetList of TimeInput
            Sequence of all ``st.time_input`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.time_input[0]`` for the first widget or
            ``at.time_input(key="my_key")`` for a widget with a given key.
        """
        return self._tree.time_input

    @property
    def title(self) -> ElementList[Title]:
        """Sequence of all ``st.title`` elements.

        Returns
        -------
        ElementList of Title
            Sequence of all ``st.title`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.title[0]`` for the first element. Title is an
            extension of the Element class.
        """
        return self._tree.title

    @property
    def toast(self) -> ElementList[Toast]:
        """Sequence of all ``st.toast`` elements.

        Returns
        -------
        ElementList of Toast
            Sequence of all ``st.toast`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.toast[0]`` for the first element. Toast is an
            extension of the Element class.
        """
        return self._tree.toast

    @property
    def toggle(self) -> WidgetList[Toggle]:
        """Sequence of all ``st.toggle`` widgets.

        Returns
        -------
        WidgetList of Toggle
            Sequence of all ``st.toggle`` widgets. Individual widgets can
            be accessed from a WidgetList by index (order on the page) or key.
            For example, ``at.toggle[0]`` for the first widget or
            ``at.toggle(key="my_key")`` for a widget with a given key.
        """
        return self._tree.toggle

    @property
    def warning(self) -> ElementList[Warning]:
        """Sequence of all ``st.warning`` elements.

        Returns
        -------
        ElementList of Warning
            Sequence of all ``st.warning`` elements. Individual elements can be
            accessed from an ElementList by index (order on the page). For
            example, ``at.warning[0]`` for the first element. Warning is an
            extension of the Element class.
        """
        return self._tree.warning

    def __len__(self) -> int:
        return len(self._tree)

    def __iter__(self):
        yield from self._tree

    def __getitem__(self, idx: int) -> Node:
        return self._tree[idx]

    def get(self, element_type: str) -> Sequence[Node]:
        """Get elements or widgets of the specified type.

        This method returns the collection of all elements or widgets of
        the specified type on the current page. Retrieve a specific element by
        using its index (order on page) or key lookup.

        Parameters
        ----------
        element_type: str
            An element attribute of ``AppTest``. For example, "button",
            "caption", or "chat_input".

        Returns
        -------
        Sequence of Elements
            Sequence of elements of the given type. Individual elements can
            be accessed from a Sequence by index (order on the page). When
            getting and ``element_type`` that is a widget, individual widgets
            can be accessed by key. For example, ``at.get("text")[0]`` for the
            first ``st.text`` element or ``at.get("slider")(key="my_key")`` for
            the ``st.slider`` widget with a given key.
        """
        return self._tree.get(element_type)

    def __repr__(self) -> str:
        return repr_(self)
