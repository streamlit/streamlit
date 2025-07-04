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

import os
from itertools import dropwhile
from pathlib import Path
from typing import Literal, NoReturn

import streamlit as st
from streamlit.errors import NoSessionContext, StreamlitAPIException
from streamlit.file_util import get_main_script_directory, normalize_path_join
from streamlit.navigation.page import StreamlitPage
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import (
    RerunData,
    ScriptRunContext,
    get_script_run_ctx,
)


@gather_metrics("stop")
def stop() -> NoReturn:  # type: ignore[misc]
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
    scope: Literal["app", "fragment"],
) -> list[str]:
    if scope == "app":
        return []

    # > scope == "fragment"
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
        raise StreamlitAPIException(
            'scope="fragment" can only be specified from `@st.fragment`-decorated '
            "functions during fragment reruns."
        )

    new_queue = list(dropwhile(lambda x: x != ctx.current_fragment_id, curr_queue))
    if not new_queue:
        raise RuntimeError(
            "Could not find current_fragment_id in fragment_id_queue. This should never happen."
        )

    return new_queue


@gather_metrics("rerun")
def rerun(  # type: ignore[misc]
    *,  # The scope argument can only be passed via keyword.
    scope: Literal["app", "fragment"] = "app",
) -> NoReturn:
    """Rerun the script immediately.

    When ``st.rerun()`` is called, Streamlit halts the current script run and
    executes no further statements. Streamlit immediately queues the script to
    rerun.

    When using ``st.rerun`` in a fragment, you can scope the rerun to the
    fragment. However, if a fragment is running as part of a full-app rerun,
    a fragment-scoped rerun is not allowed.

    Parameters
    ----------
    scope : "app" or "fragment"
        Specifies what part of the app should rerun. If ``scope`` is ``"app"``
        (default), the full app reruns. If ``scope`` is ``"fragment"``,
        Streamlit only reruns the fragment from which this command is called.

        Setting ``scope="fragment"`` is only valid inside a fragment during a
        fragment rerun. If ``st.rerun(scope="fragment")`` is called during a
        full-app rerun or outside of a fragment, Streamlit will raise a
        ``StreamlitAPIException``.

    """

    if scope not in ["app", "fragment"]:
        raise StreamlitAPIException(
            f"'{scope}'is not a valid rerun scope. Valid scopes are 'app' and 'fragment'."
        )

    ctx = get_script_run_ctx()

    if ctx and ctx.script_requests:
        query_string = ctx.query_string
        page_script_hash = ctx.page_script_hash
        cached_message_hashes = ctx.cached_message_hashes

        ctx.script_requests.request_rerun(
            RerunData(
                query_string=query_string,
                page_script_hash=page_script_hash,
                fragment_id_queue=_new_fragment_id_queue(ctx, scope),
                is_fragment_scoped_rerun=scope == "fragment",
                cached_message_hashes=cached_message_hashes,
                context_info=ctx.context_info,
            )
        )
        # Force a yield point so the runner can do the rerun
        st.empty()


@gather_metrics("switch_page")
def switch_page(page: str | Path | StreamlitPage) -> NoReturn:  # type: ignore[misc]
    """Programmatically switch the current page in a multipage app.

    When ``st.switch_page`` is called, the current page execution stops and
    the specified page runs as if the user clicked on it in the sidebar
    navigation. The specified page must be recognized by Streamlit's multipage
    architecture (your main Python file or a Python file in a ``pages/``
    folder). Arbitrary Python scripts cannot be passed to ``st.switch_page``.

    Parameters
    ----------
    page: str, Path, or st.Page
        The file path (relative to the main script) or an st.Page indicating
        the page to switch to.


    Example
    -------
    Consider the following example given this file structure:

    >>> your-repository/
    >>> ├── pages/
    >>> │   ├── page_1.py
    >>> │   └── page_2.py
    >>> └── your_app.py

    >>> import streamlit as st
    >>>
    >>> if st.button("Home"):
    >>>     st.switch_page("your_app.py")
    >>> if st.button("Page 1"):
    >>>     st.switch_page("pages/page_1.py")
    >>> if st.button("Page 2"):
    >>>     st.switch_page("pages/page_2.py")

    .. output ::
        https://doc-switch-page.streamlit.app/
        height: 350px

    """

    ctx = get_script_run_ctx()

    if not ctx or not ctx.script_requests:
        # This should never be the case
        raise NoSessionContext()

    page_script_hash = ""
    if isinstance(page, StreamlitPage):
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
            raise StreamlitAPIException(
                f"Could not find page: `{page}`. Must be the file path relative to the main script, "
                f"from the directory: `{os.path.basename(main_script_directory)}`. Only the main app file "
                "and files in the `pages/` directory are supported."
            )

        page_script_hash = matched_pages[0]["page_script_hash"]

    # We want to reset query params (with exception of embed) when switching pages
    with ctx.session_state.query_params() as qp:
        qp.clear()

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
