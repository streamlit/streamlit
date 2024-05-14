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

import threading
from pathlib import Path
from typing import Callable, Final

from blinker import Signal

from streamlit.logger import get_logger
from streamlit.source_util import PageHash, PageInfo, PageName, ScriptPath, get_pages
from streamlit.util import calc_md5
from streamlit.watcher import watch_dir

_LOGGER: Final = get_logger(__name__)


class PagesManagerV1:
    is_watching_pages_dir: bool = False
    pages_watcher_lock = threading.Lock()

    # This is a static method because we only want to watch the pages directory
    # once on initial load.
    @staticmethod
    def watch_pages_dir(pages_manager: PagesManager):
        with PagesManagerV1.pages_watcher_lock:
            if PagesManagerV1.is_watching_pages_dir:
                return

            def _on_pages_changed(_path: str) -> None:
                pages_manager.invalidate_pages_cache()

            main_script_path = Path(pages_manager.main_script_path)
            pages_dir = main_script_path.parent / "pages"
            watch_dir(
                str(pages_dir),
                _on_pages_changed,
                glob_pattern="*.py",
                allow_nonexistent=True,
            )
            PagesManagerV1.is_watching_pages_dir = True


class PagesManager:
    def __init__(self, main_script_path, **kwargs):
        self._cached_pages: dict[PageHash, PageInfo] | None = None
        self._pages_cache_lock = threading.RLock()
        self._on_pages_changed = Signal(doc="Emitted when the set of pages has changed")
        self._main_script_path: ScriptPath = main_script_path
        self._main_script_hash: PageHash = calc_md5(main_script_path)
        self._current_page_hash: PageHash = self._main_script_hash

        if kwargs.get("setup_watcher", True):
            PagesManagerV1.watch_pages_dir(self)

    @property
    def main_script_path(self) -> ScriptPath:
        return self._main_script_path

    def get_main_page(self) -> PageInfo:
        return {
            "script_path": self._main_script_path,
            "page_script_hash": self._main_script_hash,
        }

    def get_current_page_script_hash(self) -> PageHash:
        return self._current_page_hash

    def set_current_page_script_hash(self, page_hash: PageHash) -> None:
        self._current_page_hash = page_hash

    def get_active_script_hash(self) -> PageHash:
        # TODO(kmcgrady): Temporary - for MPA v2, this will be a new variable
        return self._current_page_hash

    def set_active_script_hash(self, page_hash: PageHash):
        # TODO(kmcgrady): Temporary - for MPA v2, this will set a new variable
        pass

    def get_active_script(self, page_script_hash: PageHash, page_name: PageName):
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
        # Avoid taking the lock if the pages cache hasn't been invalidated.
        pages = self._cached_pages
        if pages is not None:
            return pages

        with self._pages_cache_lock:
            # The cache may have been repopulated while we were waiting to grab
            # the lock.
            if self._cached_pages is not None:
                return self._cached_pages

            pages = get_pages(self.main_script_path)
            self._cached_pages = pages

            return pages

    def invalidate_pages_cache(self) -> None:
        _LOGGER.debug("Set of pages have changed. Invalidating cache.")
        with self._pages_cache_lock:
            self._cached_pages = None

        self._on_pages_changed.send()

    def register_pages_changed_callback(
        self,
        callback: Callable[[str], None],
    ) -> Callable[[], None]:
        """Register a callback to be called when the set of pages changes.

        The callback will be called with the path changed.
        """

        def disconnect():
            self._on_pages_changed.disconnect(callback)

        # weak=False so that we have control of when the pages changed
        # callback is deregistered.
        self._on_pages_changed.connect(callback, weak=False)

        return disconnect
