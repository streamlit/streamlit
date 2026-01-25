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

from __future__ import annotations

import collections
import contextlib
import contextvars
import threading
from dataclasses import dataclass, field
from typing import (
    TYPE_CHECKING,
    Final,
    TypeAlias,
)

from streamlit.errors import (
    NoSessionContext,
)
from streamlit.logger import get_logger
from streamlit.runtime.forward_msg_cache import (
    create_reference_msg,
    populate_hash_if_needed,
)

if TYPE_CHECKING:
    from collections.abc import Callable, Generator
    from pathlib import Path

    from streamlit.cursor import RunningCursor
    from streamlit.proto.ClientState_pb2 import ContextInfo
    from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
    from streamlit.proto.PageProfile_pb2 import Command
    from streamlit.runtime.fragment import FragmentStorage
    from streamlit.runtime.pages_manager import PagesManager
    from streamlit.runtime.scriptrunner_utils.script_requests import ScriptRequests
    from streamlit.runtime.state import SafeSessionState
    from streamlit.runtime.uploaded_file_manager import UploadedFileManager
_LOGGER: Final = get_logger(__name__)

UserInfoType: TypeAlias = dict[str, str | bool | dict[str, str] | None]


# If true, it indicates that we are in a cached function that disallows the usage of
# widgets. Using contextvars to be thread-safe.
in_cached_function: contextvars.ContextVar[bool] = contextvars.ContextVar(
    "in_cached_function", default=False
)


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
    user_info: UserInfoType
    fragment_storage: FragmentStorage
    pages_manager: PagesManager

    # Hashes of messages that are cached in the client browser:
    cached_message_hashes: set[str] = field(default_factory=set)
    context_info: ContextInfo | None = None
    gather_usage_stats: bool = False
    command_tracking_deactivated: bool = False
    tracked_commands: list[Command] = field(default_factory=list)
    tracked_commands_counter: collections.Counter[str] = field(
        default_factory=collections.Counter
    )
    _has_script_started: bool = False
    widget_ids_this_run: set[str] = field(default_factory=set)
    widget_user_keys_this_run: set[str] = field(default_factory=set)
    form_ids_this_run: set[str] = field(default_factory=set)
    cursors: dict[int, RunningCursor] = field(default_factory=dict)
    script_requests: ScriptRequests | None = None
    current_fragment_id: str | None = None
    fragment_ids_this_run: list[str] | None = None
    new_fragment_ids: set[str] = field(default_factory=set)
    in_fragment_callback: bool = False
    _active_script_hash: str = ""
    # we allow only one dialog to be open at the same time
    has_dialog_opened: bool = False

    @property
    def page_script_hash(self) -> str:
        return self.pages_manager.current_page_script_hash

    @property
    def active_script_hash(self) -> str:
        return self._active_script_hash

    @property
    def main_script_parent(self) -> Path:
        return self.pages_manager.main_script_parent

    @contextlib.contextmanager
    def run_with_active_hash(self, page_hash: str) -> Generator[None, None, None]:
        original_page_hash = self._active_script_hash
        self._active_script_hash = page_hash
        try:
            yield
        finally:
            # in the event of any exception, ensure we set the active hash back
            self._active_script_hash = original_page_hash

    def set_mpa_v2_page(self, page_script_hash: str) -> None:
        self._active_script_hash = self.pages_manager.main_script_hash
        self.pages_manager.set_current_page_script_hash(page_script_hash)

    def reset(
        self,
        query_string: str = "",
        page_script_hash: str = "",
        fragment_ids_this_run: list[str] | None = None,
        cached_message_hashes: set[str] | None = None,
        context_info: ContextInfo | None = None,
    ) -> None:
        # Check if this is a same-page rerun BEFORE updating page_script_hash
        is_same_page = self.page_script_hash == page_script_hash

        self.cursors = {}
        self.widget_ids_this_run = set()
        self.widget_user_keys_this_run = set()
        self.form_ids_this_run = set()
        self.query_string = query_string
        self.context_info = context_info
        self.pages_manager.set_current_page_script_hash(page_script_hash)
        self._active_script_hash = self.pages_manager.main_script_hash
        self._has_script_started = False
        self.command_tracking_deactivated: bool = False
        self.tracked_commands = []
        self.tracked_commands_counter = collections.Counter()
        self.current_fragment_id = None
        self.current_fragment_delta_path: list[int] = []
        self.fragment_ids_this_run = fragment_ids_this_run
        self.new_fragment_ids = set()
        self.has_dialog_opened = False
        self.cached_message_hashes = cached_message_hashes or set()

        in_cached_function.set(False)

        with self.session_state.query_params() as qp:
            # For same-page reruns (widget interactions), populate _query_params from URL
            # and set initial params for widget seeding.
            # For page transitions, both populate_from_query_string() AND
            # set_initial_query_params_from_current() are called in script_runner.py
            # BEFORE reset() to ensure filtering is applied to both _query_params
            # AND _initial_query_params, preventing stale params from previous pages
            # from seeding widgets on the new page.
            if is_same_page:
                qp.set_initial_query_params(query_string)
                qp.populate_from_query_string(query_string)

    def on_script_start(self) -> None:
        self._has_script_started = True

    def enqueue(self, msg: ForwardMsg) -> None:
        """Enqueue a ForwardMsg for this context's session."""
        msg.metadata.active_script_hash = self.active_script_hash

        # We populate the hash and cacheable field for all messages.
        # Besides the forward message cache, the hash might also be used
        # for other aspects within the frontend.
        populate_hash_if_needed(msg)
        msg_to_send = msg
        if (
            msg.metadata.cacheable
            and msg.hash
            and msg.hash in self.cached_message_hashes
        ):
            _LOGGER.debug("Sending cached message ref (hash=%s)", msg.hash)
            msg_to_send = create_reference_msg(msg)

        # Pass the message up to our associated ScriptRunner.
        self._enqueue(msg_to_send)


SCRIPT_RUN_CONTEXT_ATTR_NAME: Final = "streamlit_script_run_ctx"


def add_script_run_ctx(
    thread: threading.Thread | None = None, ctx: ScriptRunContext | None = None
) -> threading.Thread:
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
    if ctx is None and not suppress_warning:
        # Only warn about a missing ScriptRunContext if suppress_warning is False, and
        # we were started via `streamlit run`. Otherwise, the user is likely running a
        # script "bare", and doesn't need to be warned about streamlit
        # bits that are irrelevant when not connected to a session.
        _LOGGER.warning(
            "Thread '%s': missing ScriptRunContext! This warning can be ignored when "
            "running in bare mode.",
            thread.name,
        )

    return ctx


def enqueue_message(msg: ForwardMsg) -> None:
    """Enqueues a ForwardMsg proto to send to the app."""
    ctx = get_script_run_ctx()

    if ctx is None:
        raise NoSessionContext()

    if ctx.current_fragment_id and msg.WhichOneof("type") == "delta":
        msg.delta.fragment_id = ctx.current_fragment_id

    ctx.enqueue(msg)
