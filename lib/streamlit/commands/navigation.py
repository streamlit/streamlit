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

from collections.abc import Mapping, Sequence
from pathlib import Path
from typing import TYPE_CHECKING, Callable, Literal, Union

from typing_extensions import TypeAlias

from streamlit import config
from streamlit.errors import StreamlitAPIException
from streamlit.navigation.page import StreamlitPage
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.Navigation_pb2 import Navigation as NavigationProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.pages_manager import PagesManager
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    ScriptRunContext,
    get_script_run_ctx,
)
from streamlit.string_util import is_emoji

if TYPE_CHECKING:
    from streamlit.source_util import PageHash, PageInfo

SectionHeader: TypeAlias = str
PageType: TypeAlias = Union[str, Path, Callable[[], None], StreamlitPage]


def convert_to_streamlit_page(
    page_input: PageType,
) -> StreamlitPage:
    """Convert various input types to StreamlitPage objects."""
    if isinstance(page_input, StreamlitPage):
        return page_input

    if isinstance(page_input, str):
        return StreamlitPage(page_input)

    if isinstance(page_input, Path):
        return StreamlitPage(page_input)

    if callable(page_input):
        # Convert function to StreamlitPage
        return StreamlitPage(page_input)

    raise StreamlitAPIException(
        f"Invalid page type: {type(page_input)}. Must be either a string path, "
        "a pathlib.Path, a callable function, or a st.Page object."
    )


def pages_from_nav_sections(
    nav_sections: dict[SectionHeader, list[StreamlitPage]],
) -> list[StreamlitPage]:
    page_list = []
    for pages in nav_sections.values():
        page_list.extend(pages.copy())

    return page_list


def send_page_not_found(ctx: ScriptRunContext) -> None:
    msg = ForwardMsg()
    msg.page_not_found.page_name = ""
    ctx.enqueue(msg)


@gather_metrics("navigation")
def navigation(
    pages: Sequence[PageType] | Mapping[SectionHeader, Sequence[PageType]],
    *,
    position: Literal["sidebar", "hidden", "top"] = "sidebar",
    expanded: bool = False,
) -> StreamlitPage:
    """
    Configure the available pages in a multipage app.

    Call ``st.navigation`` in your entrypoint file to define the available
    pages for your app. ``st.navigation`` returns the current page, which can
    be executed using ``.run()`` method.

    When using ``st.navigation``, your entrypoint file (the file passed to
    ``streamlit run``) acts like a router or frame of common elements around
    each of your pages. Streamlit executes the entrypoint file with every app
    rerun. To execute the current page, you must call the ``.run()`` method on
    the ``StreamlitPage`` object returned by ``st.navigation``.

    The set of available pages can be updated with each rerun for dynamic
    navigation. By default, ``st.navigation`` displays the available pages in
    the sidebar if there is more than one page. This behavior can be changed
    using the ``position`` keyword argument.

    As soon as any session of your app executes the ``st.navigation`` command,
    your app will ignore the ``pages/`` directory (across all sessions).

    Parameters
    ----------
    pages : Sequence[page-like], Mapping[str, Sequence[page-like]]
        The available pages for the app.

        To create a navigation menu with no sections or page groupings,
        ``pages`` must be a list of page-like objects. Page-like objects are
        anything that can be passed to ``st.Page`` or a ``StreamlitPage``
        object returned by ``st.Page``.

        To create labeled sections or page groupings within the navigation
        menu, ``pages`` must be a dictionary. Each key is the label of a
        section and each value is the list of page-like objects for
        that section. If you use ``position="top"``, each grouping will be a
        collapsible item in the navigation menu. For top navigation, if you use
        an empty string as a section header, the pages in that section will be
        displayed at the beginning of the menu before the collapsible sections.

        When you use a string or path as a page-like object, they are
        internally passed to ``st.Page`` and converted to ``StreamlitPage``
        objects. In this case, the page will have the default title, icon, and
        path inferred from its path or filename. To customize these attributes
        for your page, initialize your page with ``st.Page``.

    position : "sidebar", "top", or "hidden"
        The position of the navigation menu. If this is ``"sidebar"``
        (default), the navigation widget appears at the top of the sidebar. If
        this is ``"top"``, the navigation appears in the top header of the app.
        If this is ``"hidden"``, the navigation widget is not displayed.

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

        The parameter is only used when ``position="sidebar"``.

    Returns
    -------
    StreamlitPage
        The current page selected by the user. To run the page, you must use
        the ``.run()`` method on it.

    Examples
    --------
    The following examples show different possible entrypoint files, each named
    ``streamlit_app.py``. An entrypoint file is passed to ``streamlit run``. It
    manages your app's navigation and serves as a router between pages.

    **Example 1: Use a callable or Python file as a page**

    You can declare pages from callables or file paths. If you pass callables
    or paths to ``st.navigation`` as a page-like objects, they are internally
    converted to ``StreamlitPage`` objects using ``st.Page``. In this case, the
    page titles, icons, and paths are inferred from the file or callable names.

    ``page_1.py`` (in the same directory as your entrypoint file):

    >>> import streamlit as st
    >>>
    >>> st.title("Page 1")

    ``streamlit_app.py``:

    >>> import streamlit as st
    >>>
    >>> def page_2():
    ...     st.title("Page 2")
    >>>
    >>> pg = st.navigation(["page_1.py", page_2])
    >>> pg.run()

    .. output::
        https://doc-navigation-example-1.streamlit.app/
        height: 200px

    **Example 2: Group pages into sections and customize them with ``st.Page``**

    You can use a dictionary to create sections within your navigation menu. In
    the following example, each page is similar to Page 1 in Example 1, and all
    pages are in the same directory. However, you can use Python files from
    anywhere in your repository. ``st.Page`` is used to give each page a custom
    title. For more information, see |st.Page|_.

    Directory structure:

    >>> your_repository/
    >>> ├── create_account.py
    >>> ├── learn.py
    >>> ├── manage_account.py
    >>> ├── streamlit_app.py
    >>> └── trial.py

    ``streamlit_app.py``:

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

    .. output::
        https://doc-navigation-example-2.streamlit.app/
        height: 300px


    **Example 3: Use top navigation**

    You can use the ``position`` parameter to place the navigation at the top
    of the app. This is useful for apps with a lot of pages because it allows
    you to create collapsible sections for each group of pages. The following
    example uses the same directory structure as Example 2 and shows how to
    create a top navigation menu.

    ``streamlit_app.py``:

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
    >>> pg = st.navigation(pages, position="top")
    >>> pg.run()

    .. output::
        https://doc-navigation-top.streamlit.app/
        height: 300px

    **Example 4: Stateful widgets across multiple pages**

    Call widget functions in your entrypoint file when you want a widget to be
    stateful across pages. Assign keys to your common widgets and access their
    values through Session State within your pages.

    ``streamlit_app.py``:

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
    >>> pg = st.navigation([page1, page2])
    >>> pg.run()

    .. output::
        https://doc-navigation-multipage-widgets.streamlit.app/
        height: 350px

    .. |st.Page| replace:: ``st.Page``
    .. _st.Page: https://docs.streamlit.io/develop/api-reference/navigation/st.page

    """
    # Validate position parameter
    if not isinstance(position, str) or position not in ["sidebar", "hidden", "top"]:
        raise StreamlitAPIException(
            f'Invalid position "{position}". '
            'The position parameter must be one of "sidebar", "hidden", or "top".'
        )

    # Disable the use of the pages feature (ie disregard v1 behavior of Multipage Apps)
    PagesManager.uses_pages_directory = False

    return _navigation(pages, position=position, expanded=expanded)


def _navigation(
    pages: Sequence[PageType] | Mapping[SectionHeader, Sequence[PageType]],
    *,
    position: Literal["sidebar", "hidden", "top"],
    expanded: bool,
) -> StreamlitPage:
    if isinstance(pages, Sequence):
        converted_pages = [convert_to_streamlit_page(p) for p in pages]
        nav_sections = {"": converted_pages}
    else:
        nav_sections = {
            section: [convert_to_streamlit_page(p) for p in section_pages]
            for section, section_pages in pages.items()  # ty: ignore[possibly-unbound-attribute]
        }
    page_list = pages_from_nav_sections(nav_sections)

    if not page_list:
        raise StreamlitAPIException(
            "`st.navigation` must be called with at least one `st.Page`."
        )

    default_page = None
    pagehash_to_pageinfo: dict[PageHash, PageInfo] = {}

    # Get the default page.
    for section_header in nav_sections:
        for page in nav_sections[section_header]:
            if page._default:
                if default_page is not None:
                    raise StreamlitAPIException(
                        "Multiple Pages specified with `default=True`. "
                        "At most one Page can be set to default."
                    )
                default_page = page

    if default_page is None:
        default_page = page_list[0]
        default_page._default = True

    ctx = get_script_run_ctx()
    if not ctx:
        # This should never run in Streamlit, but we want to make sure that
        # the function always returns a page
        default_page._can_be_called = True
        return default_page

    # Build the pagehash-to-pageinfo mapping.
    for section_header in nav_sections:
        for page in nav_sections[section_header]:
            script_path = str(page._page) if isinstance(page._page, Path) else ""

            script_hash = page._script_hash
            if script_hash in pagehash_to_pageinfo:
                # The page script hash is solely based on the url path
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

    msg = ForwardMsg()
    # Handle position logic correctly
    if position == "hidden":
        msg.navigation.position = NavigationProto.Position.HIDDEN
    elif position == "top":
        msg.navigation.position = NavigationProto.Position.TOP
    elif position == "sidebar":
        # Only apply config override if position is sidebar
        if config.get_option("client.showSidebarNavigation") is False:
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
            p.icon = f"emoji:{page.icon}" if is_emoji(page.icon) else page.icon
            p.is_default = page._default
            p.section_header = section_header
            p.url_pathname = page.url_path

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
