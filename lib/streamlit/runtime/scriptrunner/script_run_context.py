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

import collections
import threading
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Callable, Counter, Dict, Final, Union
from urllib import parse

from typing_extensions import TypeAlias

from streamlit import runtime
from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger

if TYPE_CHECKING:
    from streamlit.cursor import RunningCursor
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.proto.PageProfile_pb2 import Command
    from streamlit.runtime.fragment import FragmentStorage
    from streamlit.runtime.pages_manager import PagesManager
    from streamlit.runtime.scriptrunner.script_requests import ScriptRequests
    from streamlit.runtime.state import SafeSessionState
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager
_LOGGER: Final = get_logger(__name__)

UserInfo: TypeAlias = Dict[str, Union[str, None]]


@dataclass
class ScriptRunContext:
    """A context object that contains data for a "script run" - that is,
    data that's scoped to a single ScriptRunner execution (and therefore also
    scoped to a single connected "session").

    ScriptRunContext is used internally by virtually every `st.foo()` function.
    It is accessed only from the script thread that's created by ScriptRunner,
    or from app-created helper threads that have been "attached" to the
    ScriptRunContext via `add_script_run_ctx`.

    Streamlit code typically retrieves the active ScriptRunContext via the
    `get_script_run_ctx` function.
    """

    session_id: str
    _enqueue: Callable[[ForwardMsg], None]
    query_string: str
    session_state: SafeSessionState
    uploaded_file_mgr: UploadedFileManager
    main_script_path: str
    user_info: UserInfo
    fragment_storage: FragmentStorage
    pages_manager: PagesManager

    gather_usage_stats: bool = False
    command_tracking_deactivated: bool = False
    tracked_commands: list[Command] = field(default_factory=list)
    tracked_commands_counter: Counter[str] = field(default_factory=collections.Counter)
    _set_page_config_allowed: bool = True
    _has_script_started: bool = False
    widget_ids_this_run: set[str] = field(default_factory=set)
    widget_user_keys_this_run: set[str] = field(default_factory=set)
    form_ids_this_run: set[str] = field(default_factory=set)
    cursors: dict[int, RunningCursor] = field(default_factory=dict)
    script_requests: ScriptRequests | None = None
    current_fragment_id: str | None = None
    new_fragment_ids: set[str] = field(default_factory=set)
    # we allow only one dialog to be open at the same time
    has_dialog_opened: bool = False
    # If true, it indicates that we are in a cached function that disallows
    # the usage of widgets.
    disallow_cached_widget_usage: bool = False

    # TODO(willhuang1997): Remove this variable when experimental query params are removed
    _experimental_query_params_used = False
    _production_query_params_used = False

    @property
    def page_script_hash(self):
        return self.pages_manager.get_current_page_script_hash()

    @property
    def active_script_hash(self):
        return self.pages_manager.get_active_script_hash()

    def reset(
        self,
        query_string: str = "",
        page_script_hash: str = "",
    ) -> None:
        self.cursors = {}
        self.widget_ids_this_run = set()
        self.widget_user_keys_this_run = set()
        self.form_ids_this_run = set()
        self.query_string = query_string
        self.pages_manager.set_current_page_script_hash(page_script_hash)
        # Permit set_page_config when the ScriptRunContext is reused on a rerun
        self._set_page_config_allowed = True
        self._has_script_started = False
        self.command_tracking_deactivated: bool = False
        self.tracked_commands = []
        self.tracked_commands_counter = collections.Counter()
        self.current_fragment_id = None
        self.current_fragment_delta_path: list[int] = []
        self.fragment_ids_this_run = None
        self.new_fragment_ids = set()
        self.has_dialog_opened = False
        self.disallow_cached_widget_usage = False

        parsed_query_params = parse.parse_qs(query_string, keep_blank_values=True)
        with self.session_state.query_params() as qp:
            qp.clear_with_no_forward_msg()
            for key, val in parsed_query_params.items():
                if len(val) == 0:
                    qp.set_with_no_forward_msg(key, val="")
                elif len(val) == 1:
                    qp.set_with_no_forward_msg(key, val=val[-1])
                else:
                    qp.set_with_no_forward_msg(key, val)

    def on_script_start(self) -> None:
        self._has_script_started = True

    def enqueue(self, msg: ForwardMsg) -> None:
        """Enqueue a ForwardMsg for this context's session."""
        if msg.HasField("page_config_changed") and not self._set_page_config_allowed:
            raise StreamlitAPIException(
                "`set_page_config()` can only be called once per app page, "
                "and must be called as the first Streamlit command in your script.\n\n"
                "For more information refer to the [docs]"
                "(https://docs.streamlit.io/develop/api-reference/configuration/st.set_page_config)."
            )

        # We want to disallow set_page config if one of the following occurs:
        # - set_page_config was called on this message
        # - The script has already started and a different st call occurs (a delta)
        if msg.HasField("page_config_changed") or (
            msg.HasField("delta") and self._has_script_started
        ):
            self._set_page_config_allowed = False

        msg.metadata.active_script_hash = self.active_script_hash

        # Pass the message up to our associated ScriptRunner.
        self._enqueue(msg)

    def ensure_single_query_api_used(self):
        if self._experimental_query_params_used and self._production_query_params_used:
            raise StreamlitAPIException(
                "Using `st.query_params` together with either `st.experimental_get_query_params` "
                "or `st.experimental_set_query_params` is not supported. Please convert your app "
                "to only use `st.query_params`"
            )

    def mark_experimental_query_params_used(self):
        self._experimental_query_params_used = True
        self.ensure_single_query_api_used()

    def mark_production_query_params_used(self):
        self._production_query_params_used = True
        self.ensure_single_query_api_used()


SCRIPT_RUN_CONTEXT_ATTR_NAME: Final = "streamlit_script_run_ctx"


def add_script_run_ctx(
    thread: threading.Thread | None = None, ctx: ScriptRunContext | None = None
):
    """Adds the current ScriptRunContext to a newly-created thread.

    This should be called from this thread's parent thread,
    before the new thread starts.

    Parameters
    ----------
    thread : threading.Thread
        The thread to attach the current ScriptRunContext to.
    ctx : ScriptRunContext or None
        The ScriptRunContext to add, or None to use the current thread's
        ScriptRunContext.

    Returns
    -------
    threading.Thread
        The same thread that was passed in, for chaining.

    """
    if thread is None:
        thread = threading.current_thread()
    if ctx is None:
        ctx = get_script_run_ctx()
    if ctx is not None:
        setattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, ctx)
    return thread


def get_script_run_ctx(suppress_warning: bool = False) -> ScriptRunContext | None:
    """
    Parameters
    ----------
    suppress_warning : bool
        If True, don't log a warning if there's no ScriptRunContext.
    Returns
    -------
    ScriptRunContext | None
        The current thread's ScriptRunContext, or None if it doesn't have one.

    """
    thread = threading.current_thread()
    ctx: ScriptRunContext | None = getattr(thread, SCRIPT_RUN_CONTEXT_ATTR_NAME, None)
    if ctx is None and runtime.exists() and not suppress_warning:
        # Only warn about a missing ScriptRunContext if suppress_warning is False, and
        # we were started via `streamlit run`. Otherwise, the user is likely running a
        # script "bare", and doesn't need to be warned about streamlit
        # bits that are irrelevant when not connected to a session.
        _LOGGER.warning("Thread '%s': missing ScriptRunContext", thread.name)

    return ctx


# Needed to avoid circular dependencies while running tests.
import streamlit  # noqa: E402, F401
