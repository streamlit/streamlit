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

from pathlib import Path
from typing import TYPE_CHECKING, Any

from streamlit.util import calc_md5

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
        self._main_script_path = main_script_path
        self._main_script_hash: PageHash = calc_md5(main_script_path)
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
        # If pages are not set, provide the common page info where
        # - the main script path is the executing script to start
        # - the page script hash and name reflects the intended page requested
        return self._pages or {
            self.main_script_hash: {
                "page_script_hash": self.intended_page_script_hash or "",
                "page_name": self.intended_page_name or "",
                "icon": "",
                "script_path": self.main_script_path,
            }
        }

    def set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
        self._pages = pages

    def get_page_script(self, fallback_page_hash: PageHash = "") -> PageInfo | None:
        if self._pages is None:
            return None

        if self.intended_page_script_hash:
            # We assume that if initial page hash is specified, that a page should
            # exist, so we check out the page script hash or the default page hash
            # as a backup
            return self._pages.get(
                self.intended_page_script_hash,
                self._pages.get(fallback_page_hash, None),
            )
        if self.intended_page_name:
            # If a user navigates directly to a non-main page of an app, the
            # the page name can identify the page script to run
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
