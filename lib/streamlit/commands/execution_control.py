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

import os
import time
from collections.abc import Iterable, Mapping, Sequence
from itertools import dropwhile
from pathlib import Path
from typing import TYPE_CHECKING, Literal, NoReturn

import streamlit as st
from streamlit.errors import (
    NoSessionContext,
    StreamlitAPIException,
    StreamlitInvalidLayoutContextError,
    StreamlitInvalidParameterTypeError,
    StreamlitPageNotFoundError,
    StreamlitValueError,
)
from streamlit.file_util import get_main_script_directory, normalize_path_join
from streamlit.navigation.page import Page, _validate_registered_page
from streamlit.runtime.fragment import _check_not_parallel_worker
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.runtime_util import MESSAGE_FLUSH_INTERVAL_SECS
from streamlit.runtime.scriptrunner import (
    RerunData,
    RerunException,
    ScriptRunContext,
    get_script_run_ctx,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    RunLocation,
    ThreadState,
)

if TYPE_CHECKING:
    from streamlit.runtime.state.query_params import QueryParams, QueryParamsInput

# Keyed reruns (st.rerun("<key>")) are only valid from widget callbacks.
# Calling from the main body or a fragment body would abort the current run
# mid-execution, which is not a supported pattern.
_KEYED_RERUN_ALLOWED_LOCATIONS: frozenset[RunLocation] = frozenset(
    {RunLocation.CALLBACK}
)


def _is_fragment_scoped(scope: str | Sequence[str]) -> bool:
    """Whether this rerun targets specific fragments rather than the whole app.

    Every scope other than ``"app"`` is a fragment rerun: ``"fragment"`` is the
    self-targeting variant (rerun the fragment the callback lives in), while a
    key or list of keys targets other fragments (or self) by name. All of these
    set ``is_fragment_scoped_rerun=True`` on ``RerunData``, which lets the
    script runner preempt the current run body.

    Note: callback-vote coalescing may still escalate to a full-app rerun if
    another callback returns normally or calls plain ``st.rerun()``; that
    escalation happens in ``SessionState._call_callbacks``, not here.
    """
    return scope != "app"


@gather_metrics("stop")
def stop() -> NoReturn:  # type: ignore[misc] # ty: ignore[invalid-return-type]
    """Stops execution immediately.

    Streamlit will not run any statements after `st.stop()`.
    We recommend rendering a message to explain why the script has stopped.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> name = st.text_input("Name")
    >>> if not name:
    >>>   st.warning('Please input a name.')
    >>>   st.stop()
    >>> st.success("Thank you for inputting a name.")

    """
    ctx = get_script_run_ctx()

    if ctx and ctx.script_requests:
        ctx.script_requests.request_stop()
        # Force a yield point so the runner can stop
        st.empty()


def _new_fragment_id_queue(
    ctx: ScriptRunContext,
    scope: str | Sequence[str],
) -> list[str]:
    """Build the fragment_id_queue for a rerun request from ``scope``."""
    if scope == "app":
        return []

    if scope != "fragment":
        # Any scope other than the reserved "app"/"fragment" level names is one or
        # more fragment keys: an event-scoped rerun of the named fragment(s).
        ts = ThreadState.get()
        if ts.run_location not in _KEYED_RERUN_ALLOWED_LOCATIONS:
            raise StreamlitAPIException(
                "Passing a fragment key to `st.rerun()` is only allowed from a "
                "widget callback (e.g. `on_change` / `on_click`). Calling it "
                "from the main script body or a fragment body would abort the "
                "current run. If you meant to rerun the whole app or the "
                "current fragment, use `scope='app'` or `scope='fragment'`.",
                error_id="rerun-keyed-outside-callback",
            )
        return ctx.fragment_storage.resolve_target(scope)

    # scope == "fragment": rerun the fragment that is currently executing.
    curr_queue = ctx.fragment_ids_this_run

    # If st.rerun(scope="fragment") is called during a full script run, we raise an
    # exception. This occurs, of course, if st.rerun(scope="fragment") is called
    # outside of a fragment, but it somewhat surprisingly occurs if it gets called
    # from within a fragment during a run of the full script. While this behavior may
    # be surprising, it seems somewhat reasonable given that the correct behavior of
    # calling st.rerun(scope="fragment") in this situation is unclear to me:
    #   * Rerunning just the fragment immediately may cause weirdness down the line
    #     as any part of the script that occurs after the fragment will not be
    #     executed.
    #   * Waiting until the full script run completes before rerunning the fragment
    #     seems odd (even if we normally do this before running a fragment not
    #     triggered by st.rerun()) because it defers the execution of st.rerun().
    #   * Rerunning the full app feels incorrect as we're seemingly ignoring the
    #     `scope` argument.
    # With these issues and given that it seems pretty unnatural to have a
    # fragment-scoped rerun happen during a full script run to begin with, it seems
    # reasonable to just disallow this completely for now.
    if not curr_queue:
        raise StreamlitInvalidLayoutContextError(
            'scope="fragment" can only be specified from `@st.fragment`-decorated '
            "functions during fragment reruns."
        )

    new_queue = list(
        dropwhile(lambda x: x != ThreadState.get().fragment_id, curr_queue)
    )
    if not new_queue:  # pragma: no cover - defensive
        raise RuntimeError(
            "Could not find current_fragment_id in fragment_id_queue. This should never happen."
        )

    return new_queue


def _set_query_params_for_switch(
    query_params_state: QueryParams,
    new_query_params: QueryParamsInput | None,
) -> None:
    """Set query params for a switch page."""

    if new_query_params is None:
        query_params_state.clear()
        return

    if isinstance(new_query_params, Mapping) or (
        isinstance(new_query_params, Iterable)
        and not isinstance(
            new_query_params,  # type: ignore[unreachable]
            (str, bytes),
        )
    ):
        query_params_state.from_dict(new_query_params)
        return

    raise StreamlitInvalidParameterTypeError(
        "query_params",
        type(new_query_params).__name__,
        ["mapping", "iterable of (key, value) pairs"],
    )


@gather_metrics("rerun")
def rerun(  # type: ignore[misc]
    scope: Literal["app", "fragment"] | str | int | Sequence[str | int] = "app",
) -> NoReturn:  # ty: ignore[invalid-return-type]
    """Rerun the script immediately.

    When ``st.rerun()`` is called, Streamlit halts the current script run and
    executes no further statements. Streamlit immediately queues the script to
    rerun.

    When using ``st.rerun`` in a fragment, you can scope the rerun to the
    fragment. However, if a fragment is running as part of a full-app rerun,
    a fragment-scoped rerun is not allowed.

    Parameters
    ----------
    scope : "app", "fragment", str, int, or list of str/int
        Specifies what part of the app should rerun.

        - ``"app"`` (default): the full app reruns.
        - ``"fragment"``: Streamlit only reruns the fragment from which this
          command is called. Only valid inside a fragment during a fragment
          rerun. Raises ``StreamlitAPIException`` during a full-app rerun or
          outside of a fragment.
        - A fragment key (str or int) or list of fragment keys: reruns only the
          named fragment(s), replacing the interaction's default rerun. The key
          must match the ``key`` argument passed to ``@st.fragment(key=...)``.
          An ``int`` key is normalized to its string representation.
          An unknown key raises ``StreamlitAPIException``. This form is only
          valid from a widget callback (``on_change`` / ``on_click``);
          calling it from the main script body or a fragment body raises
          ``StreamlitAPIException``. If a sibling callback in the same
          interaction returns normally or calls ``st.rerun()``, the result
          escalates to a full-app rerun.

        .. note::
            When a keyed rerun replaces the interaction default, only the
            targeted fragment(s) rerun. Other widgets changed in the same
            interaction (e.g. form fields submitted alongside the callback)
            have their values applied to session state, but they won't render
            until the next full-app rerun.

    Examples
    --------
    Rerun a named fragment from a widget callback:

    >>> import streamlit as st
    >>>
    >>> @st.fragment(key="charts")
    >>> def charts():
    >>>     st.line_chart({"data": [1, 2, 3]})
    >>>
    >>> charts()
    >>> st.button(
    >>>     "Refresh charts",
    >>>     on_click=lambda: st.rerun("charts"),
    >>> )

    Rerun multiple fragments at once:

    >>> @st.fragment(key="table")
    >>> def table():
    >>>     st.dataframe({"col": [1, 2, 3]})
    >>>
    >>> table()
    >>> st.button(
    >>>     "Refresh all",
    >>>     on_click=lambda: st.rerun(["charts", "table"]),
    >>> )

    """
    if isinstance(scope, int):
        scope = str(scope)
    if isinstance(scope, (bytes, bytearray)):
        raise StreamlitInvalidParameterTypeError(
            "scope",
            type(scope).__name__,
            ["str", "int", "list[str | int]"],
        )
    if not isinstance(scope, (str, Sequence)):
        raise StreamlitInvalidParameterTypeError(
            "scope",
            type(scope).__name__,
            ["str", "int", "list[str | int]"],
        )
    if isinstance(scope, str) and scope == "":
        raise StreamlitValueError(
            "scope",
            ["'app'", "'fragment'", "a fragment key", "a list of keys"],
            detail="Got an empty string.",
        )
    if isinstance(scope, Sequence) and not isinstance(scope, str) and len(scope) == 0:
        raise StreamlitValueError(
            "scope",
            ["'app'", "'fragment'", "a fragment key", "a list of keys"],
            detail="Got an empty list.",
        )
    if isinstance(scope, Sequence) and not isinstance(scope, str):
        normalized: list[str] = []
        for name in scope:
            if isinstance(name, int):
                normalized.append(str(name))
            elif not isinstance(name, str):
                raise StreamlitInvalidParameterTypeError(
                    "scope list items",
                    type(name).__name__,
                    ["str", "int"],
                )
            elif name == "":
                raise StreamlitValueError(
                    "scope list items",
                    ["non-empty strings or ints"],
                    detail="Found an empty string in the list.",
                )
            else:
                normalized.append(name)
        for name in normalized:
            if name in {"app", "fragment"}:
                raise StreamlitValueError(
                    "scope",
                    ["fragment keys"],
                    detail=f"'{name}' is a reserved scope name and cannot appear inside a list. "
                    f"Pass '{name}' directly as a string.",
                )
        scope = normalized

    ctx = get_script_run_ctx()

    if ctx and ctx.script_requests:
        query_string = ctx.query_string
        page_script_hash = ctx.page_script_hash
        cached_message_hashes = ctx.cached_message_hashes
        fragment_id_queue = _new_fragment_id_queue(ctx, scope)

        rerun_data = RerunData(
            query_string=query_string,
            page_script_hash=page_script_hash,
            fragment_id_queue=fragment_id_queue,
            is_fragment_scoped_rerun=_is_fragment_scoped(scope),
            cached_message_hashes=cached_message_hashes,
            context_info=ctx.context_info,
        )

        if ThreadState.get().run_location == RunLocation.CALLBACK:
            # Halt the callback immediately — _run_callback_and_record_rerun
            # catches this and records it on the interaction's votes.
            #
            # The request is NOT queued via request_rerun here; _call_callbacks
            # flushes all pending reruns after the last callback returns.
            # Queueing now would let a sibling callback's yield point pick up
            # this request and abort prematurely.
            raise RerunException(rerun_data)

        # Body-level calls: queue the request and halt via a yield point so
        # the script runner can inspect it and decide whether to preempt.
        ctx.script_requests.request_rerun(rerun_data)
        st.empty()


@gather_metrics("switch_page")
def switch_page(  # type: ignore[misc]
    page: str | Path | Page,
    *,
    query_params: QueryParamsInput | None = None,
) -> NoReturn:  # ty: ignore[invalid-return-type]
    """Programmatically switch the current page in a multipage app.

    When ``st.switch_page`` is called, the current page execution stops and
    the specified page runs as if the user clicked on it in the navigation
    menu. The specified page must be recognized by Streamlit's multipage
    architecture. Arbitrary Python scripts and URLs can't be passed to
    ``st.switch_page``.

    Parameters
    ----------
    page : str, Path, or Page
        The page to switch to. This can be one of the following values:

        - Path to a Python file: The path can be a string or ``pathlib.Path``
          object. It can be absolute or relative to the entrypoint file. The
          Python file must be the source of a page in ``st.navigation``.

          If you are using the ``pages/`` directory instead of
          ``st.navigation``, the Python file must be your entrypoint file or
          a file in the ``pages/`` directory.

        - ``Page``: The source of the ``Page`` and its
          ``url_path`` must match a page defined in ``st.navigation``. The
          ``Page`` must be internal and can't be defined by a URL.
          Use ``st.Page`` to create a ``Page`` object.

        To switch to a page defined by a ``callable``, you must use a
        ``Page`` object.

    query_params : dict, list of tuples, or None
        Query parameters to apply when navigating to the target page.
        This can be a dictionary or an iterable of key-value tuples. Values can
        be strings or iterables of strings (for repeated keys). When this is
        ``None`` (default), all non-embed query parameters are cleared during
        navigation.

    Examples
    --------
    **Example 1: Basic usage**

    The following example shows how to switch to a different page in a
    multipage app that uses the ``pages/`` directory:

    .. code-block:: text

        your-repository/
        ├── pages/
        │   ├── page_1.py
        │   └── page_2.py
        └── your_app.py

    >>> import streamlit as st
    >>>
    >>> if st.button("Home"):
    >>>     st.switch_page("your_app.py")
    >>> if st.button("Page 1"):
    >>>     st.switch_page("pages/page_1.py")
    >>> if st.button("Page 2"):
    >>>     st.switch_page("pages/page_2.py")

    .. output::
        https://doc-switch-page.streamlit.app/
        height: 350px

    **Example 2: Passing query parameters**

    The following example shows how to pass query parameters when switching to a
    different page. This example uses ``st.navigation`` to create a multipage app.

    .. code-block:: text

        your-repository/
        ├── page_2.py
        └── your_app.py

    >>> import streamlit as st
    >>>
    >>> def page_1():
    >>>     st.title("Page 1")
    >>>     if st.button("Switch to Page 2"):
    >>>         st.switch_page("page_2.py", query_params={"utm_source": "page_1"})
    >>>
    >>> pg = st.navigation([page_1, "page_2.py"])
    >>> pg.run()

    .. output::
        https://doc-switch-page-query-params.streamlit.app/
        height: 350px

    """
    _check_not_parallel_worker("st.switch_page")

    ctx = get_script_run_ctx()

    if not ctx or not ctx.script_requests:
        # This should never be the case
        raise NoSessionContext()

    page_script_hash = ""
    if isinstance(page, Page):
        if page.is_external:
            raise StreamlitAPIException(
                "Cannot use st.switch_page with external URL pages. "
                "Use st.page_link instead to create a link to external pages.",
                error_id="switch-page-external-url-not-supported",
            )
        _validate_registered_page(page)
        page_script_hash = page._script_hash
    else:
        # Convert Path to string if necessary
        if isinstance(page, Path):
            page = str(page)

        main_script_directory = get_main_script_directory(ctx.main_script_path)
        requested_page = os.path.realpath(
            normalize_path_join(main_script_directory, page)
        )
        all_app_pages = ctx.pages_manager.get_pages().values()

        matched_pages = [p for p in all_app_pages if p["script_path"] == requested_page]

        if len(matched_pages) == 0:
            raise StreamlitPageNotFoundError(
                page=page,
                main_script_directory=main_script_directory,
                uses_pages_directory=bool(PagesManager.uses_pages_directory),
            )

        page_script_hash = matched_pages[0]["page_script_hash"]

    # Reset query params (with exception of embed) and optionally apply overrides.
    with ctx.session_state.query_params() as qp:
        _set_query_params_for_switch(qp, query_params)

    # Safeguard: sleep longer than the flush interval to ensure at least one
    # complete flush cycle delivers the query params before the rerun clears
    # outstanding messages. Sleep is placed after the with block to release
    # the session state lock first.
    time.sleep(2 * MESSAGE_FLUSH_INTERVAL_SECS)

    ctx.script_requests.request_rerun(
        RerunData(
            query_string=ctx.query_string,
            page_script_hash=page_script_hash,
            cached_message_hashes=ctx.cached_message_hashes,
            context_info=ctx.context_info,
        )
    )
    # Force a yield point so the runner can do the rerun
    st.empty()
