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

import types
from pathlib import Path
from typing import TYPE_CHECKING

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.source_util import page_icon_and_name
from streamlit.string_util import validate_icon_or_emoji
from streamlit.util import calc_md5

if TYPE_CHECKING:
    from collections.abc import Callable


@gather_metrics("Page")
def Page(  # noqa: N802
    page: str | Path | Callable[[], None],
    *,
    title: str | None = None,
    icon: str | None = None,
    url_path: str | None = None,
    default: bool = False,
) -> StreamlitPage:
    """Configure a page for ``st.navigation`` in a multipage app.

    Call ``st.Page`` to initialize a ``StreamlitPage`` object, and pass it to
    ``st.navigation`` to declare a page in your app.

    When a user navigates to a page, ``st.navigation`` returns the selected
    ``StreamlitPage`` object. Call ``.run()`` on the returned ``StreamlitPage``
    object to execute the page. You can only run the page returned by
    ``st.navigation``, and you can only run it once per app rerun.

    A page can be defined by a Python file or ``Callable``.

    Parameters
    ----------
    page : str, Path, or callable
        The page source as a ``Callable`` or path to a Python file. If the page
        source is defined by a Python file, the path can be a string or
        ``pathlib.Path`` object. Paths can be absolute or relative to the
        entrypoint file. If the page source is defined by a ``Callable``, the
        ``Callable`` can't accept arguments.

    title : str or None
        The title of the page. If this is ``None`` (default), the page title
        (in the browser tab) and label (in the navigation menu) will be
        inferred from the filename or callable name in ``page``. For more
        information, see `Overview of multipage apps
        <https://docs.streamlit.io/st.page.automatic-page-labels>`_.

    icon : str or None
        An optional emoji or icon to display next to the page title and label.
        If ``icon`` is ``None`` (default), no icon is displayed next to the
        page label in the navigation menu, and a Streamlit icon is displayed
        next to the title (in the browser tab). If ``icon`` is a string, the
        following options are valid:

        - A single-character emoji. For example, you can set ``icon="🚨"``
            or ``icon="🔥"``. Emoji short codes are not supported.

        - An icon from the Material Symbols library (rounded style) in the
            format ``":material/icon_name:"`` where "icon_name" is the name
            of the icon in snake case.

            For example, ``icon=":material/thumb_up:"`` will display the
            Thumb Up icon. Find additional icons in the `Material Symbols \
            <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
            font library.

        - ``"spinner"``: Displays a spinner as an icon. In this case, the
          spinner only displays next to the page label in the navigation menu.
          The spinner isn't used as the page favicon next to the title in the
          browser tab. The favicon is the default Streamlit icon unless
          otherwise specified with the ``page_icon`` parameter of
          ``st.set_page_config``.

    url_path : str or None
        The page's URL pathname, which is the path relative to the app's root
        URL. If this is ``None`` (default), the URL pathname will be inferred
        from the filename or callable name in ``page``. For more information,
        see `Overview of multipage apps
        <https://docs.streamlit.io/st.page.automatic-page-urls>`_.

        The default page will have a pathname of ``""``, indicating the root
        URL of the app. If you set ``default=True``, ``url_path`` is ignored.
        ``url_path`` can't include forward slashes; paths can't include
        subdirectories.

    default : bool
        Whether this page is the default page to be shown when the app is
        loaded. If ``default`` is ``False`` (default), the page will have a
        nonempty URL pathname. However, if no default page is passed to
        ``st.navigation`` and this is the first page, this page will become the
        default page. If ``default`` is ``True``, then the page will have
        an empty pathname and ``url_path`` will be ignored.

    Returns
    -------
    StreamlitPage
        The page object associated to the given script.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> def page2():
    >>>     st.title("Second page")
    >>>
    >>> pg = st.navigation([
    >>>     st.Page("page1.py", title="First page", icon="🔥"),
    >>>     st.Page(page2, title="Second page", icon=":material/favorite:"),
    >>> ])
    >>> pg.run()
    """
    return StreamlitPage(
        page, title=title, icon=icon, url_path=url_path, default=default
    )


class StreamlitPage:
    """A page within a multipage Streamlit app.

    Use ``st.Page`` to initialize a ``StreamlitPage`` object.

    Attributes
    ----------
    icon : str
        The icon of the page.

        If no icon was declared in ``st.Page``, this property returns ``""``.

    title : str
        The title of the page.

        Unless declared otherwise in ``st.Page``, the page title is inferred
        from the filename or callable name. For more information, see
        `Overview of multipage apps
        <https://docs.streamlit.io/st.page.automatic-page-labels>`_.

    url_path : str
        The page's URL pathname, which is the path relative to the app's root
        URL.

        Unless declared otherwise in ``st.Page``, the URL pathname is inferred
        from the filename or callable name. For more information, see
        `Overview of multipage apps
        <https://docs.streamlit.io/st.page.automatic-page-urls>`_.

        The default page will always have a ``url_path`` of ``""`` to indicate
        the root URL (e.g. homepage).

    """

    def __init__(
        self,
        page: str | Path | Callable[[], None],
        *,
        title: str | None = None,
        icon: str | None = None,
        url_path: str | None = None,
        default: bool = False,
    ) -> None:
        # Must appear before the return so all pages, even if running in bare Python,
        # have a _default property. This way we can always tell which script needs to run.
        self._default: bool = default

        ctx = get_script_run_ctx()
        if not ctx:
            return

        main_path = ctx.pages_manager.main_script_parent
        if isinstance(page, str):
            page = Path(page)
        if isinstance(page, Path):
            page = (main_path / page).resolve()

            if not page.is_file():
                raise StreamlitAPIException(
                    f"Unable to create Page. The file `{page.name}` could not be found."
                )

        inferred_name = ""
        inferred_icon = ""
        if isinstance(page, Path):
            inferred_icon, inferred_name = page_icon_and_name(page)
        elif hasattr(page, "__name__"):
            inferred_name = str(page.__name__)
        elif title is None:
            # At this point, we know the page is not a string or a path, so it
            # must be a callable. We expect it to have a __name__ attribute,
            # but in special cases (e.g. a callable class instance), one may
            # not exist. In that case, we should inform the user the title is
            # mandatory.
            raise StreamlitAPIException(
                "Cannot infer page title for Callable. Set the `title=` keyword argument."
            )

        self._page: Path | Callable[[], None] = page
        self._title: str = title or inferred_name.replace("_", " ")

        if icon is not None:
            # validate user provided icon.
            validate_icon_or_emoji(icon)
        self._icon: str = icon or inferred_icon

        if self._title.strip() == "":
            raise StreamlitAPIException(
                "The title of the page cannot be empty or consist of underscores/spaces only"
            )

        self._url_path: str = inferred_name
        if url_path is not None:
            if url_path.strip() == "" and not default:
                raise StreamlitAPIException(
                    "The URL path cannot be an empty string unless the page is the default page."
                )

            self._url_path = url_path.strip("/")
            if "/" in self._url_path:
                raise StreamlitAPIException(
                    "The URL path cannot contain a nested path (e.g. foo/bar)."
                )

        if self._icon:
            validate_icon_or_emoji(self._icon)

        # used by st.navigation to ordain a page as runnable
        self._can_be_called: bool = False

    @property
    def title(self) -> str:
        """The title of the page.

        Unless declared otherwise in ``st.Page``, the page title is inferred
        from the filename or callable name. For more information, see
        `Overview of multipage apps
        <https://docs.streamlit.io/st.page.automatic-page-labels>`_.
        """
        return self._title

    @property
    def icon(self) -> str:
        """The icon of the page.

        If no icon was declared in ``st.Page``, this property returns ``""``.
        """
        return self._icon

    @property
    def url_path(self) -> str:
        """The page's URL pathname, which is the path relative to the app's \
        root URL.

        Unless declared otherwise in ``st.Page``, the URL pathname is inferred
        from the filename or callable name. For more information, see
        `Overview of multipage apps
        <https://docs.streamlit.io/st.page.automatic-page-urls>`_.

        The default page will always have a ``url_path`` of ``""`` to indicate
        the root URL (e.g. homepage).
        """
        return "" if self._default else self._url_path

    def run(self) -> None:
        """Execute the page.

        When a page is returned by ``st.navigation``, use the ``.run()`` method
        within your entrypoint file to render the page. You can only call this
        method on the page returned by ``st.navigation``. You can only call
        this method once per run of your entrypoint file.

        """
        if not self._can_be_called:
            raise StreamlitAPIException(
                "This page cannot be called directly. Only the page returned from st.navigation can be called once."
            )

        self._can_be_called = False

        ctx = get_script_run_ctx()
        if not ctx:
            return

        with ctx.run_with_active_hash(self._script_hash):
            if callable(self._page):
                self._page()
                return
            code = ctx.pages_manager.get_page_script_byte_code(str(self._page))
            module = types.ModuleType("__main__")
            # We want __file__ to be the string path to the script
            module.__dict__["__file__"] = str(self._page)
            exec(code, module.__dict__)  # noqa: S102

    @property
    def _script_hash(self) -> str:
        return calc_md5(self._url_path)
