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

import os
import threading
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Final

from streamlit import source_util
from streamlit.logger import get_logger
from streamlit.util import calc_md5
from streamlit.watcher import watch_dir

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner.script_cache import ScriptCache
    from streamlit.source_util import PageHash, PageInfo, PageName, ScriptPath

_LOGGER: Final = get_logger(__name__)


class PagesStrategyV1:
    """
    Strategy for MPA v1. This strategy handles pages being set directly
    by a call to `st.navigation`. The key differences here are:
    - The pages are defined by the existence of a `pages` directory
    - We will ensure one watcher is watching the scripts in the directory.
    - Only one script runs for a full rerun.
    - We know at the beginning the intended page script to run.

    NOTE: Thread safety of the pages is handled by the source_util module
    """

    is_watching_pages_dir: bool = False
    pages_watcher_lock = threading.Lock()

    # This is a static method because we only want to watch the pages directory
    # once on initial load.
    @staticmethod
    def watch_pages_dir(pages_manager: PagesManager):
        with PagesStrategyV1.pages_watcher_lock:
            if PagesStrategyV1.is_watching_pages_dir:
                return

            def _handle_page_changed(_path: str) -> None:
                source_util.invalidate_pages_cache()

            main_script_path = Path(pages_manager.main_script_path)
            pages_dir = main_script_path.parent / "pages"
            watch_dir(
                str(pages_dir),
                _handle_page_changed,
                glob_pattern="*.py",
                allow_nonexistent=True,
            )
            PagesStrategyV1.is_watching_pages_dir = True

    def __init__(self, pages_manager: PagesManager, setup_watcher: bool = True):
        self.pages_manager = pages_manager

        if setup_watcher:
            PagesStrategyV1.watch_pages_dir(pages_manager)

    @property
    def initial_active_script_hash(self) -> PageHash:
        return self.pages_manager.current_page_script_hash

    def get_initial_active_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> PageInfo | None:
        pages = self.get_pages()

        if page_script_hash:
            return pages.get(page_script_hash, None)
        elif not page_script_hash and page_name:
            # If a user navigates directly to a non-main page of an app, we get
            # the first script run request before the list of pages has been
            # sent to the frontend. In this case, we choose the first script
            # with a name matching the requested page name.
            return next(
                filter(
                    # There seems to be this weird bug with mypy where it
                    # thinks that p can be None (which is impossible given the
                    # types of pages), so we add `p and` at the beginning of
                    # the predicate to circumvent this.
                    lambda p: p and (p["page_name"] == page_name),
                    pages.values(),
                ),
                None,
            )

        # If no information about what page to run is given, default to
        # running the main page.
        # Safe because pages will at least contain the app's main page.
        main_page_info = list(pages.values())[0]
        return main_page_info

    def get_pages(self) -> dict[PageHash, PageInfo]:
        return source_util.get_pages(self.pages_manager.main_script_path)

    def register_pages_changed_callback(
        self,
        callback: Callable[[str], None],
    ) -> Callable[[], None]:
        return source_util.register_pages_changed_callback(callback)

    def set_pages(self, _pages: dict[PageHash, PageInfo]) -> None:
        raise NotImplementedError("Unable to set pages in this V1 strategy")

    def get_page_script(self, _fallback_page_hash: PageHash) -> PageInfo | None:
        raise NotImplementedError("Unable to get page script in this V1 strategy")


class PagesStrategyV2:
    """
    Strategy for MPA v2. This strategy handles pages being set directly
    by a call to `st.navigation`. The key differences here are:
    - The pages are set directly by the user
    - The initial active script will always be the main script
    - More than one script can run in a single app run (sequentially),
      so we must keep track of the active script hash
    - We rely on pages manager to retrieve the intended page script per run

    NOTE: We don't provide any locks on the pages since the pages are not
    shared across sessions. Only the user script thread can write to
    pages and the event loop thread only reads
    """

    def __init__(self, pages_manager: PagesManager, **kwargs):
        self.pages_manager = pages_manager
        self._pages: dict[PageHash, PageInfo] | None = None

    def get_initial_active_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> PageInfo:
        return {
            # We always run the main script in V2 as it's the common code
            "script_path": self.pages_manager.main_script_path,
            "page_script_hash": page_script_hash
            or self.pages_manager.main_script_hash,  # Default Hash
        }

    @property
    def initial_active_script_hash(self) -> PageHash:
        return self.pages_manager.main_script_hash

    def get_page_script(self, fallback_page_hash: PageHash) -> PageInfo | None:
        if self._pages is None:
            return None

        if self.pages_manager.intended_page_script_hash:
            # We assume that if initial page hash is specified, that a page should
            # exist, so we check out the page script hash or the default page hash
            # as a backup
            return self._pages.get(
                self.pages_manager.intended_page_script_hash,
                self._pages.get(fallback_page_hash, None),
            )
        elif self.pages_manager.intended_page_name:
            # If a user navigates directly to a non-main page of an app, the
            # the page name can identify the page script to run
            return next(
                filter(
                    # There seems to be this weird bug with mypy where it
                    # thinks that p can be None (which is impossible given the
                    # types of pages), so we add `p and` at the beginning of
                    # the predicate to circumvent this.
                    lambda p: p
                    and (p["url_pathname"] == self.pages_manager.intended_page_name),
                    self._pages.values(),
                ),
                None,
            )

        return self._pages.get(fallback_page_hash, None)

    def get_pages(self) -> dict[PageHash, PageInfo]:
        # If pages are not set, provide the common page info where
        # - the main script path is the executing script to start
        # - the page script hash and name reflects the intended page requested
        return self._pages or {
            self.pages_manager.main_script_hash: {
                "page_script_hash": self.pages_manager.intended_page_script_hash or "",
                "page_name": self.pages_manager.intended_page_name or "",
                "icon": "",
                "script_path": self.pages_manager.main_script_path,
            }
        }

    def set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
        self._pages = pages

    def register_pages_changed_callback(
        self,
        callback: Callable[[str], None],
    ) -> Callable[[], None]:
        # V2 strategy does not handle any pages changed event
        return lambda: None


class PagesManager:
    """
    PagesManager is responsible for managing the set of pages based on the
    strategy. By default, PagesManager uses V1 which relies on the original
    assumption that there exists a `pages` directory with all the scripts.

    If the `pages` are being set directly, the strategy is switched to V2.
    This indicates someone has written an `st.navigation` call in their app
    which informs us of the pages.

    NOTE: Each strategy handles its own thread safety when accessing the pages
    """

    DefaultStrategy: type[PagesStrategyV1 | PagesStrategyV2] = PagesStrategyV1

    def __init__(
        self,
        main_script_path: ScriptPath,
        script_cache: ScriptCache | None = None,
        **kwargs,
    ):
        self._main_script_path = main_script_path
        self._main_script_hash: PageHash = calc_md5(main_script_path)
        self.pages_strategy = PagesManager.DefaultStrategy(self, **kwargs)
        self._script_cache = script_cache
        self._intended_page_script_hash: PageHash | None = None
        self._intended_page_name: PageName | None = None
        self._current_page_script_hash: PageHash = ""

    @property
    def main_script_path(self) -> ScriptPath:
        return self._main_script_path

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

    @property
    def initial_active_script_hash(self) -> PageHash:
        return self.pages_strategy.initial_active_script_hash

    @property
    def mpa_version(self) -> int:
        return 2 if isinstance(self.pages_strategy, PagesStrategyV2) else 1

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

    def get_initial_active_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> PageInfo | None:
        return self.pages_strategy.get_initial_active_script(
            page_script_hash, page_name
        )

    def get_pages(self) -> dict[PageHash, PageInfo]:
        return self.pages_strategy.get_pages()

    def set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
        # Manually setting the pages indicates we are using MPA v2.
        if isinstance(self.pages_strategy, PagesStrategyV1):
            if os.path.exists(Path(self.main_script_path).parent / "pages"):
                _LOGGER.warning(
                    "st.navigation was called in an app with a pages/ directory. This may cause unusual app behavior. You may want to rename the pages/ directory."
                )
            PagesManager.DefaultStrategy = PagesStrategyV2
            self.pages_strategy = PagesStrategyV2(self)

        self.pages_strategy.set_pages(pages)

    def get_page_script(self, fallback_page_hash: PageHash = "") -> PageInfo | None:
        # We assume the pages strategy is V2 cause this is used
        # in the st.navigation call, but we just swallow the error
        try:
            return self.pages_strategy.get_page_script(fallback_page_hash)
        except NotImplementedError:
            return None

    def register_pages_changed_callback(
        self,
        callback: Callable[[str], None],
    ) -> Callable[[], None]:
        """Register a callback to be called when the set of pages changes.

        The callback will be called with the path changed.
        """

        return self.pages_strategy.register_pages_changed_callback(callback)

    def get_page_script_byte_code(self, script_path: str) -> Any:
        if self._script_cache is None:
            # Returning an empty string for an empty script
            return ""

        return self._script_cache.get_bytecode(script_path)
