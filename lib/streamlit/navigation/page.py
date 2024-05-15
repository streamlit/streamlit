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

import types
from pathlib import Path
from typing import Callable

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner.script_run_context import get_script_run_ctx
from streamlit.source_util import page_icon_and_name
from streamlit.string_util import validate_icon_or_emoji
from streamlit.util import calc_md5


@gather_metrics("Page")
def Page(
    page: str | Path | Callable[[], None],
    *,
    title: str | None = None,
    icon: str | None = None,
    default: bool = False,
):
    """Configure a page in `st.navigation` in a multipage app.

    The Page object is passed to `st.navigation` and returned when the user
    navigates to that page. Call `Page.run()` on the returned Page in your
    main script to execute the page code.

    Page code can be specified by file path of the page (relative to the main
    script) or by passing a Callable such as a function.

    Parameters
    ----------

    page: str or Path or callable
        The path to the script file or a callable that defines the page.

    title: str or None
        The title of the page. If None, the title will be inferred from the
        page path or callable name.

    icon: str or None
        The icon of the page. If None, the icon will be inferred from the
        page path.

    default: bool
        Whether this page is the default page to be shown when the app is
        loaded. Only one page can be marked default. If no default page is
        provided, the first page will be the default page.

    Example
    -------
    >>> import streamlit as st
    >>>
    >>> def page2():
    >>>     st.title("Second page")
    >>> pg = st.navigation([
    >>>	    st.Page("page1.py", title="First page", icon="🔥"),
    >>>	    st.Page(page2, title="Second page", icon=":material/favorite:"),
    >>> ])
    >>> pg.run()
    """
    return StreamlitPage(page, title=title, icon=icon, default=default)


class StreamlitPage:
    def __init__(
        self,
        page: str | Path | Callable[[], None],
        *,
        title: str | None = None,
        icon: str | None = None,
        default: bool = False,
    ):
        ctx = get_script_run_ctx()
        if not ctx:
            return

        main_path = Path(ctx.pages_manager.main_script_path).parent
        if isinstance(page, str):
            page = Path(page)
        if isinstance(page, Path):
            page = (main_path / page).resolve()

        inferred_name = ""
        inferred_icon = ""
        if isinstance(page, Path):
            inferred_icon, inferred_name = page_icon_and_name(page)
        elif title is None:
            if hasattr(page, "__name__"):
                inferred_name = str(page.__name__)
            else:
                raise StreamlitAPIException(
                    "Cannot infer page title for Callable. Set the `title=` keyword argument."
                )

        self._page: Path | Callable[[], None] = page
        self.title: str = title or inferred_name
        self.icon: str = icon or inferred_icon

        if self.icon:
            validate_icon_or_emoji(self.icon)

        self.default: bool = default
        # used by st.navigation to ordain a page as runnable
        self._can_be_called: bool = False

    def run(self) -> None:
        if not self._can_be_called:
            raise StreamlitAPIException(
                "This page cannot be called directly. Only the page returned from st.navigation can be called once."
            )

        self._can_be_called = False

        ctx = get_script_run_ctx()
        if not ctx:
            return

        ex = None
        with ctx.pages_manager.run_with_active_hash(self._script_hash):
            try:
                if callable(self._page):
                    self._page()
                    return
                else:
                    code = ctx.pages_manager.get_page_script_byte_code(str(self._page))

                    module = types.ModuleType("__page__")
                    module.__dict__["__file__"] = self._page
                    exec(code, module.__dict__)
            except Exception as e:
                # Catch the exception so we can raise it after we've reset the active page
                ex = e

        if ex:
            raise ex

    @property
    def _script_hash(self) -> str:
        if isinstance(self._page, Path):
            h = calc_md5(str(self._page))
        else:
            h = calc_md5(self.title)
        return h
