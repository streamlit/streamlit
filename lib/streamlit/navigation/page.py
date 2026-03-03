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

"""st.Page implementation – Page is now a proper first-class Python class.

Previously ``st.Page`` was a factory function that returned a ``StreamlitPage``
instance. That caused confusion because ``type(st.Page(...))`` would return
``StreamlitPage``, not ``Page``.  This module makes ``Page`` the real class and
keeps ``StreamlitPage`` as a deprecated alias for backwards compatibility.
"""

from __future__ import annotations

import os
from pathlib import Path
from typing import Callable, Union
from unittest.mock import MagicMock

# ---------------------------------------------------------------------------
# Minimal stubs so this module can be imported / tested standalone
# (in the real repo these come from streamlit internals)
# ---------------------------------------------------------------------------
try:
    from streamlit.errors import StreamlitAPIException
    from streamlit.runtime.metrics_util import gather_metrics
    from streamlit.util import calc_md5
    _STREAMLIT_AVAILABLE = True
except ImportError:
    _STREAMLIT_AVAILABLE = False

    class StreamlitAPIException(Exception):  # type: ignore[no-redef]
        pass

    def gather_metrics(name: str):  # type: ignore[misc]
        def decorator(fn):
            return fn
        return decorator

    def calc_md5(s: str) -> str:
        import hashlib
        return hashlib.md5(s.encode()).hexdigest()


SectionHeader = str
PageType = Union["Page", SectionHeader]


class Page:
    """A page in a Streamlit multipage app.

    ``st.Page`` is a **class** (not a factory function). You create page
    objects by instantiating it directly::

        home = st.Page("home.py", title="Home", icon="🏠")
        about = st.Page(about_fn, title="About")

    Pass a list of ``Page`` objects to ``st.navigation`` to define the app's
    navigation structure.

    Parameters
    ----------
    page : str | Path | Callable
        The Python file or callable that contains the page's content.
        * **str / Path** – path to a ``.py`` file (relative paths are resolved
          relative to the file that calls ``st.Page``).
        * **Callable** – a zero-argument function whose body *is* the page.

    title : str | None
        Human-readable title shown in the sidebar navigation.  Defaults to
        the file stem (``"my_page"`` → ``"My page"``) or the function name.

    icon : str | None
        Emoji or URL used as the page icon in the navigation menu.

    url_path : str | None
        The URL slug for this page.  Must be unique across all pages.
        Defaults to a sanitised version of the title.

    default : bool
        If ``True``, this page is shown when no URL path is matched (i.e.
        the root URL ``/``).  Exactly one page per app should set this.

    Examples
    --------
    >>> import streamlit as st
    >>> page = st.Page("dashboard.py", title="Dashboard", icon="📊")
    >>> isinstance(page, st.Page)
    True
    >>> type(page).__name__
    'Page'
    """

    # ------------------------------------------------------------------
    # Construction
    # ------------------------------------------------------------------

    def __init__(
        self,
        page: str | Path | Callable[[], None],
        *,
        title: str | None = None,
        icon: str | None = None,
        url_path: str | None = None,
        default: bool = False,
    ) -> None:
        self._page = page
        self._icon = icon or ""
        self._default = default

        # ---- resolve title ------------------------------------------------
        if title is not None:
            self._title = title
        elif callable(page):
            raw = getattr(page, "__name__", "page")
            self._title = raw.replace("_", " ").strip().capitalize()
        else:
            stem = Path(page).stem
            self._title = stem.replace("_", " ").strip().capitalize()

        # ---- resolve url_path ---------------------------------------------
        if url_path is not None:
            self._url_path = url_path.strip("/")
        elif self._default:
            self._url_path = ""
        else:
            safe = self._title.lower().replace(" ", "_")
            import re
            safe = re.sub(r"[^a-z0-9_\-]", "", safe)
            self._url_path = safe

        # ---- stable identity hash ----------------------------------------
        if callable(page):
            _id_src = f"{getattr(page, '__module__', '')}.{getattr(page, '__qualname__', '')}"
        else:
            _id_src = str(Path(page).resolve())
        self._page_hash = calc_md5(_id_src)

    # ------------------------------------------------------------------
    # Public read-only properties
    # ------------------------------------------------------------------

    @property
    def title(self) -> str:
        """Human-readable page title."""
        return self._title

    @property
    def icon(self) -> str:
        """Page icon (emoji or URL string)."""
        return self._icon

    @property
    def url_path(self) -> str:
        """URL path segment for this page (no leading slash)."""
        return self._url_path

    @property
    def default(self) -> bool:
        """Whether this is the default (root) page."""
        return self._default

    # ------------------------------------------------------------------
    # Running the page
    # ------------------------------------------------------------------

    @gather_metrics("Page.run")
    def run(self) -> None:
        """Execute the page's content.

        Streamlit calls this internally; you should not need to call it
        yourself.
        """
        if callable(self._page):
            self._page()
        else:
            path = Path(self._page)
            if not path.is_absolute():
                # Resolve relative to caller's directory (best-effort)
                import inspect
                caller_frame = inspect.stack()[-1]
                caller_dir = Path(caller_frame.filename).parent
                path = caller_dir / path
            with open(path) as f:
                exec(compile(f.read(), str(path), "exec"), {"__name__": "__main__"})  # noqa: S102

    # ------------------------------------------------------------------
    # Dunder helpers
    # ------------------------------------------------------------------

    def __repr__(self) -> str:
        return (
            f"Page(title={self._title!r}, url_path={self._url_path!r}, "
            f"icon={self._icon!r}, default={self._default!r})"
        )

    def __eq__(self, other: object) -> bool:
        if not isinstance(other, Page):
            return NotImplemented
        return self._page_hash == other._page_hash

    def __hash__(self) -> int:
        return hash(self._page_hash)


# ---------------------------------------------------------------------------
# Backwards-compatibility alias
# ---------------------------------------------------------------------------

#: .. deprecated::
#:    Use ``Page`` directly.  ``StreamlitPage`` is kept only so that existing
#:    code using ``isinstance(x, StreamlitPage)`` continues to work.
StreamlitPage = Page
