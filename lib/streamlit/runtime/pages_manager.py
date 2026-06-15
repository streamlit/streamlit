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

import threading
from pathlib import Path
from typing import TYPE_CHECKING, Any

from streamlit.util import calc_hash

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner.script_cache import ScriptCache
    from streamlit.source_util import PageHash, PageInfo, PageName, ScriptPath


class PagesManager:
    """
    PagesManager is responsible for managing the set of pages that make up
    the entire application. At the start we assume the main script is the
    only page. As the script runs, the main script can call `st.navigation`
    to set the set of pages that make up the app.
    """

    uses_pages_directory: bool | None = None

    def __init__(
        self,
        main_script_path: ScriptPath,
        script_cache: ScriptCache | None = None,
        **kwargs: Any,
    ) -> None:
        self._lock = threading.Lock()
        self._main_script_path = main_script_path
        self._main_script_hash: PageHash = calc_hash(main_script_path)
        self._script_cache = script_cache
        self._intended_page_script_hash: PageHash | None = None
        self._intended_page_name: PageName | None = None
        self._current_page_script_hash: PageHash = ""
        self._pages: dict[PageHash, PageInfo] | None = None
        # A relic of v1 of Multipage apps, we performed special handling
        # for apps with a pages directory. We will keep this flag around
        # for now to maintain the behavior for apps that were created with
        # the pages directory feature.
        #
        # NOTE: we will update the feature if the flag has not been set
        #       this means that if users use v2 behavior, the flag will
        #       always be set to False
        if PagesManager.uses_pages_directory is None:
            PagesManager.uses_pages_directory = Path(
                self.main_script_parent / "pages"
            ).exists()

    @property
    def main_script_path(self) -> ScriptPath:
        return self._main_script_path

    @property
    def main_script_parent(self) -> Path:
        return Path(self._main_script_path).parent

    @property
    def main_script_hash(self) -> PageHash:
        return self._main_script_hash

    @property
    def current_page_script_hash(self) -> PageHash:
        return self._current_page_script_hash

    @property
    def intended_page_name(self) -> PageName | None:
        return self._intended_page_name

    @property
    def intended_page_script_hash(self) -> PageHash | None:
        return self._intended_page_script_hash

    def set_current_page_script_hash(self, page_script_hash: PageHash) -> None:
        self._current_page_script_hash = page_script_hash

    def get_main_page(self) -> PageInfo:
        return {
            "script_path": self._main_script_path,
            "page_script_hash": self._main_script_hash,
        }

    def set_script_intent(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> None:
        # Not lock-protected: attribute assignment is atomic in both GIL and
        # free-threaded CPython, and intent is always set before script
        # execution begins (not concurrently with set_pages_and_resolve).
        self._intended_page_script_hash = page_script_hash
        self._intended_page_name = page_name

    def get_initial_active_script(self, page_script_hash: PageHash) -> PageInfo | None:
        return {
            # We always run the main script in V2 as it's the common code
            "script_path": self.main_script_path,
            "page_script_hash": page_script_hash
            or self.main_script_hash,  # Default Hash
        }

    def get_pages(self) -> dict[PageHash, PageInfo]:
        """Return a snapshot of the current page registry.

        Lock-protected for free-threaded Python (PEP 703) where
        iterating a dict during concurrent mutation is unsafe.
        Returns a shallow copy so callers can safely iterate.

        If pages are not set, returns a default page info where the main
        script path is the executing script and the page script hash/name
        reflects the intended page requested.
        """
        with self._lock:
            if self._pages is not None:
                return dict(self._pages)
            return {
                self.main_script_hash: {
                    "page_script_hash": self.intended_page_script_hash or "",
                    "page_name": self.intended_page_name or "",
                    "icon": "",
                    "script_path": self.main_script_path,
                }
            }

    def _set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
        """Internal method for setting pages. Use set_pages_and_resolve() instead."""
        with self._lock:
            self._pages = pages

    def set_pages_and_resolve(
        self,
        pages: dict[PageHash, PageInfo],
        fallback_page_hash: PageHash = "",
    ) -> PageInfo | None:
        """Atomically set the page registry and resolve the current page.

        Both operations are performed under a single lock, ensuring the page
        resolution sees the pages that were just set even under concurrent
        access.

        Parameters
        ----------
        pages : dict[PageHash, PageInfo]
            The page registry to set.
        fallback_page_hash : PageHash
            The fallback page hash to use if the intended page is not found.

        Returns
        -------
        PageInfo | None
            The resolved page info, or None if no matching page is found.
        """
        with self._lock:
            self._pages = pages
            return self._resolve_page_script(fallback_page_hash)

    def _resolve_page_script(
        self, fallback_page_hash: PageHash = ""
    ) -> PageInfo | None:
        """Internal resolver — caller must hold self._lock.

        Resolves the page script based on intended_page_script_hash or
        intended_page_name, falling back to fallback_page_hash if needed.
        """
        if self._pages is None:
            return None

        if self.intended_page_script_hash:
            # If a page hash is specified, we assume a page should exist.
            # Return the matching page or fall back to the default page hash.
            return self._pages.get(
                self.intended_page_script_hash,
                self._pages.get(fallback_page_hash, None),
            )
        if self.intended_page_name:
            # If a user navigates directly to a non-main page of an app,
            # the page name can identify the page script to run.
            # Note: The lambda captures self.intended_page_name at execution
            # time. This is safe because attribute reads are atomic in both
            # GIL and free-threaded CPython, and set_script_intent is always
            # called before script execution begins.
            return next(
                filter(
                    # There seems to be this weird bug with mypy where it
                    # thinks that p can be None (which is impossible given the
                    # types of pages), so we add `p and` at the beginning of
                    # the predicate to circumvent this.
                    lambda p: p and (p["url_pathname"] == self.intended_page_name),
                    self._pages.values(),
                ),
                None,
            )

        return self._pages.get(fallback_page_hash, None)

    def get_page_script_byte_code(self, script_path: str) -> Any:
        if self._script_cache is None:
            # Returning an empty string for an empty script
            return ""

        return self._script_cache.get_bytecode(script_path)
