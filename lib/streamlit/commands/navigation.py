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

from pathlib import Path
from typing import TYPE_CHECKING, Literal

from typing_extensions import TypeAlias

from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.Navigation_pb2 import Navigation as NavigationProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ScriptRunContext,
    get_script_run_ctx,
)

if TYPE_CHECKING:
    from streamlit.navigation.page import StreamlitPage
    from streamlit.source_util import PageHash, PageInfo

SectionHeader: TypeAlias = str


def pages_from_nav_sections(
    nav_sections: dict[SectionHeader, list[StreamlitPage]],
) -> list[StreamlitPage]:
    page_list = []
    for pages in nav_sections.values():
        for page in pages:
            page_list.append(page)

    return page_list


def send_page_not_found(ctx: ScriptRunContext):
    msg = ForwardMsg()
    msg.page_not_found.page_name = ""
    ctx.enqueue(msg)


@gather_metrics("navigation")
def navigation(
    pages: list[StreamlitPage] | dict[SectionHeader, list[StreamlitPage]],
    *,
    position: Literal["sidebar", "hidden"] = "sidebar",
    expanded: bool = False,
) -> StreamlitPage:
    """
    Configure the available pages in a multipage app.

    Call ``st.navigation`` in your entrypoint file with one or more pages
    defined by ``st.Page``. ``st.navigation`` returns the current page, which
    can be executed using ``.run()`` method.

    When using ``st.navigation``, your entrypoint file (the file passed to
    ``streamlit run``) acts like a router or frame of common elements around
    each of your pages. Streamlit executes the entrypoint file with every app
    rerun. To execute the current page, you must call the ``.run()`` method on
    the ``StreamlitPage`` object returned by ``st.navigation``.

    The set of available pages can be updated with each rerun for dynamic
    navigation. By default, ``st.navigation`` draws the available pages in the
    side navigation if there is more than one page. This behavior can be
    changed using the ``position`` keyword argument.

    As soon as any session of your app executes the ``st.navigation`` command,
    your app will ignore the ``pages/`` directory (across all sessions).

    Parameters
    ----------
    pages : list[StreamlitPage] or dict[str, list[StreamlitPage]]
        The available pages for the app.

        To create labeled sections or page groupings within the navigation
        menu, ``pages`` must be a dictionary. Each key is the label of a
        section and each value is the list of ``StreamlitPage`` objects for
        that section.

        To create a navigation menu with no sections or page groupings,
        ``pages`` must be a list of ``StreamlitPage`` objects.

        Use ``st.Page`` to create ``StreamlitPage`` objects.

    position : "sidebar" or "hidden"
        The position of the navigation menu. If ``position`` is ``"sidebar"``
        (default), the navigation widget appears at the top of the sidebar. If
        ``position`` is ``"hidden"``, the navigation widget is not displayed.

        If there is only one page in ``pages``, the navigation will be hidden
        for any value of ``position``.

    expanded : bool
        Whether the navigation menu should be expanded. If this is ``False``
        (default), the navigation menu will be collapsed and will include a
        button to view more options when there are too many pages to display.
        If this is ``True``, the navigation menu will always be expanded; no
        button to collapse the menu will be displayed.

        If ``st.navigation`` changes from ``expanded=True`` to
        ``expanded=False`` on a rerun, the menu will stay expanded and a
        collapse button will be displayed.

    Returns
    -------
    StreamlitPage
        The current page selected by the user.

    Examples
    --------
    The following examples show possible entrypoint files, which is the file
    you pass to ``streamlit run``. Your entrypoint file manages your app's
    navigation and serves as a router between pages.

    You can declare pages from callables or file paths.

    >>> import streamlit as st
    >>> from page_functions import page1
    >>>
    >>> pg = st.navigation([st.Page(page1), st.Page("page2.py")])
    >>> pg.run()

    Use a dictionary to create sections within your navigation menu.

    >>> import streamlit as st
    >>>
    >>> pages = {
    ...     "Your account": [
    ...         st.Page("create_account.py", title="Create your account"),
    ...         st.Page("manage_account.py", title="Manage your account"),
    ...     ],
    ...     "Resources": [
    ...         st.Page("learn.py", title="Learn about us"),
    ...         st.Page("trial.py", title="Try it out"),
    ...     ],
    ... }
    >>>
    >>> pg = st.navigation(pages)
    >>> pg.run()

    Call widget functions in your entrypoint file when you want a widget to be
    stateful across pages. Assign keys to your common widgets and access their
    values through Session State within your pages.

    >>> import streamlit as st
    >>>
    >>> def page1():
    >>>     st.write(st.session_state.foo)
    >>>
    >>> def page2():
    >>>     st.write(st.session_state.bar)
    >>>
    >>> # Widgets shared by all the pages
    >>> st.sidebar.selectbox("Foo", ["A", "B", "C"], key="foo")
    >>> st.sidebar.checkbox("Bar", key="bar")
    >>>
    >>> pg = st.navigation([st.Page(page1), st.Page(page2)])
    >>> pg.run()

    """
    nav_sections = {"": pages} if isinstance(pages, list) else pages
    page_list = pages_from_nav_sections(nav_sections)

    if not page_list:
        raise StreamlitAPIException(
            "`st.navigation` must be called with at least one `st.Page`."
        )

    default_page = None
    pagehash_to_pageinfo: dict[PageHash, PageInfo] = {}

    # This nested loop keeps track of two things:
    # 1. the default page
    # 2. the pagehash to pageinfo mapping
    for section_header in nav_sections:
        for page in nav_sections[section_header]:
            if page._default:
                if default_page is not None:
                    raise StreamlitAPIException(
                        "Multiple Pages specified with `default=True`. "
                        "At most one Page can be set to default."
                    )
                default_page = page

            if isinstance(page._page, Path):
                script_path = str(page._page)
            else:
                script_path = ""

            script_hash = page._script_hash
            if script_hash in pagehash_to_pageinfo:
                # The page script hash is soley based on the url path
                # So duplicate page script hashes are due to duplicate url paths
                raise StreamlitAPIException(
                    f"Multiple Pages specified with URL pathname {page.url_path}. "
                    "URL pathnames must be unique. The url pathname may be "
                    "inferred from the filename, callable name, or title."
                )

            pagehash_to_pageinfo[script_hash] = {
                "page_script_hash": script_hash,
                "page_name": page.title,
                "icon": page.icon,
                "script_path": script_path,
                "url_pathname": page.url_path,
            }

    if default_page is None:
        default_page = page_list[0]
        default_page._default = True

    msg = ForwardMsg()
    if position == "hidden":
        msg.navigation.position = NavigationProto.Position.HIDDEN
    else:
        msg.navigation.position = NavigationProto.Position.SIDEBAR

    msg.navigation.expanded = expanded
    msg.navigation.sections[:] = nav_sections.keys()
    for section_header in nav_sections:
        for page in nav_sections[section_header]:
            p = msg.navigation.app_pages.add()
            p.page_script_hash = page._script_hash
            p.page_name = page.title
            p.icon = page.icon
            p.is_default = page._default
            p.section_header = section_header
            p.url_pathname = page.url_path

    ctx = get_script_run_ctx()
    if not ctx:
        # This should never run in Streamlit, but we want to make sure that
        # the function always returns a page
        default_page._can_be_called = True
        return default_page

    # Inform our page manager about the set of pages we have
    ctx.pages_manager.set_pages(pagehash_to_pageinfo)
    found_page = ctx.pages_manager.get_page_script(
        fallback_page_hash=default_page._script_hash
    )

    page_to_return = None
    if found_page:
        found_page_script_hash = found_page["page_script_hash"]
        matching_pages = [
            p for p in page_list if p._script_hash == found_page_script_hash
        ]
        if len(matching_pages) > 0:
            page_to_return = matching_pages[0]

    if not page_to_return:
        send_page_not_found(ctx)
        page_to_return = default_page

    # Ordain the page that can be called
    page_to_return._can_be_called = True
    msg.navigation.page_script_hash = page_to_return._script_hash
    # Set the current page script hash to the page that is going to be executed
    ctx.set_mpa_v2_page(page_to_return._script_hash)

    # This will either navigation or yield if the page is not found
    ctx.enqueue(msg)

    return page_to_return
