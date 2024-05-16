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

import contextlib
import os
import threading
from pathlib import Path
from typing import Any, Callable, Final, Optional, Type

from blinker import Signal

import streamlit.source_util as source_util
from streamlit.logger import get_logger
from streamlit.proto.NewSession_pb2 import NewSession
from streamlit.proto.PagesChanged_pb2 import PagesChanged
from streamlit.runtime.scriptrunner.script_cache import ScriptCache
from streamlit.source_util import PageHash, PageInfo, PageName, ScriptPath
from streamlit.util import calc_md5
from streamlit.watcher import watch_dir

_LOGGER: Final = get_logger(__name__)


class PagesStrategyV1:
    is_watching_pages_dir: bool = False
    pages_watcher_lock = threading.Lock()

    # This is a static method because we only want to watch the pages directory
    # once on initial load.
    @staticmethod
    def watch_pages_dir(pages_manager: PagesManager):
        with PagesStrategyV1.pages_watcher_lock:
            if PagesStrategyV1.is_watching_pages_dir:
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
            PagesStrategyV1.is_watching_pages_dir = True

    def __init__(self, pages_manager: PagesManager, setup_watcher: bool = True):
        self.pages_manager = pages_manager

        if setup_watcher:
            PagesStrategyV1.watch_pages_dir(pages_manager)

    # In MPA v1, there's no difference between the active hash
    # and the page script hash.
    def get_active_script_hash(self) -> PageHash:
        return self.pages_manager.current_page_hash

    def set_active_script_hash(self, _page_hash: PageHash):
        raise NotImplementedError("Unable to set the active script hash in V1 strategy")

    def get_initial_active_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> Optional[PageInfo]:
        pages = self.pages_manager.get_pages()

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

    def set_initial_script(
        self, _page_script_hash: PageHash, _page_name: PageName
    ) -> None:
        # Intentionally does nothing
        pass

    def get_pages(self) -> dict[PageHash, PageInfo]:
        return source_util.get_pages(self.pages_manager.main_script_path)

    def set_pages(self, _pages: dict[PageHash, PageInfo]) -> None:
        raise NotImplementedError("Unable to set pages in this V1 strategy")

    def get_page_script(self, _fallback_page_hash: PageHash) -> Optional[PageInfo]:
        raise NotImplementedError("Unable to get page script in this V1 strategy")

    def populate_app_pages(self, proto: NewSession | PagesChanged):
        default_setting = True
        for page_script_hash, page_info in self.pages_manager.get_pages().items():
            page_proto = proto.app_pages.add()

            page_proto.page_script_hash = page_script_hash
            page_proto.page_name = page_info["page_name"]
            page_proto.icon = page_info["icon"]
            # Set the first page as default on first iteration
            page_proto.is_default = default_setting
            default_setting = False


class PagesStrategyV2:
    def __init__(self, pages_manager: PagesManager, **kwargs):
        self.pages_manager = pages_manager
        self._active_script_hash: PageHash = self.pages_manager.main_script_hash
        self._pages: dict[PageHash, PageInfo] | None = None
        self._initial_page_script_hash: PageHash | None = None
        self._initial_page_name: PageName | None = None

    def get_active_script_hash(self) -> PageHash:
        return self._active_script_hash

    def set_active_script_hash(self, page_hash: PageHash):
        self._active_script_hash = page_hash

    def get_initial_active_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> PageInfo:
        # At this point, we cannot determine the active script at start
        # as we don't have the list of pages yet. So we will pass
        # the common code script path and the hash
        self._initial_page_script_hash = page_script_hash
        self._initial_page_name = page_name

        return {
            # We always run the main script in V2 as it's the common code
            "script_path": self.pages_manager.main_script_path,
            "page_script_hash": page_script_hash
            or self.pages_manager.main_script_hash,  # Default Hash
        }

    def set_initial_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> None:
        self._initial_page_script_hash = page_script_hash
        self._initial_page_name = page_name

    def get_page_script(self, fallback_page_hash: PageHash) -> Optional[PageInfo]:
        if self._pages is None:
            return None

        if self._initial_page_script_hash:
            # We assume that if initial page hash is specified, that a page should
            # exist, so we check out the page script hash or the default page hash
            # as a backup
            return self._pages.get(
                self._initial_page_script_hash,
                self._pages.get(fallback_page_hash, None),
            )
        elif self._initial_page_name:
            # If a user navigates directly to a non-main page of an app, the
            # the page name can identify the page script to run
            return next(
                filter(
                    # There seems to be this weird bug with mypy where it
                    # thinks that p can be None (which is impossible given the
                    # types of pages), so we add `p and` at the beginning of
                    # the predicate to circumvent this.
                    lambda p: p and (p["url_pathname"] == self._initial_page_name),
                    self._pages.values(),
                ),
                None,
            )

        return self._pages.get(fallback_page_hash, None)

    def get_pages(self) -> dict[PageHash, PageInfo]:
        # If pages are not set, provide the common page info
        return self._pages or {
            self.pages_manager.main_script_hash: {
                "page_script_hash": self.pages_manager.main_script_hash,
                "page_name": "",
                "icon": "",
                "script_path": self.pages_manager.main_script_path,
            }
        }

    def set_pages(self, pages: dict[PageHash, PageInfo]) -> None:
        self._pages = pages

    def populate_app_pages(self, proto: NewSession | PagesChanged):
        # Always supply the first page as the main script.
        # It should be disregarded by the frontend in favor of a
        # navigation call
        page_proto = proto.app_pages.add()
        self.get_initial_active_script("", "")
        page_proto.page_script_hash = self.pages_manager.main_script_path
        page_proto.page_name = ""
        page_proto.icon = ""


class PagesManager:
    DefaultStrategy: Type[PagesStrategyV1 | PagesStrategyV2] = PagesStrategyV1

    def __init__(self, main_script_path, script_cache=None, **kwargs):
        self._cached_pages: dict[PageHash, PageInfo] | None = None
        self._pages_cache_lock = threading.RLock()
        self._on_pages_changed = Signal(doc="Emitted when the set of pages has changed")
        self._main_script_path: ScriptPath = main_script_path
        self._main_script_hash: PageHash = calc_md5(main_script_path)
        self._current_page_hash: PageHash = self._main_script_hash
        self.pages_strategy = PagesManager.DefaultStrategy(self, **kwargs)
        self._script_cache: ScriptCache | None = script_cache

    @property
    def current_page_hash(self) -> PageHash:
        return self._current_page_hash

    @property
    def main_script_path(self) -> ScriptPath:
        return self._main_script_path

    @property
    def main_script_hash(self) -> PageHash:
        return self._main_script_hash

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
        return self.pages_strategy.get_active_script_hash()

    def set_active_script_hash(self, page_hash: PageHash):
        return self.pages_strategy.set_active_script_hash(page_hash)

    def set_initial_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> None:
        return self.pages_strategy.set_initial_script(page_script_hash, page_name)

    def get_initial_active_script(
        self, page_script_hash: PageHash, page_name: PageName
    ) -> Optional[PageInfo]:
        return self.pages_strategy.get_initial_active_script(
            page_script_hash, page_name
        )

    @contextlib.contextmanager
    def run_with_active_hash(self, page_hash):
        original_page_hash = self.get_active_script_hash()
        self.set_active_script_hash(page_hash)
        try:
            yield
        finally:
            # in the event of any exception, ensure we set the active hash back
            self.set_active_script_hash(original_page_hash)

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

            pages = self.pages_strategy.get_pages()
            self._cached_pages = pages

            return pages

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
        self._cached_pages = pages
        self._on_pages_changed.send()

    def get_page_script(self, fallback_page_hash: PageHash = "") -> Optional[PageInfo]:
        # We assume the pages strategy is V2 cause this is used
        # in the st.navigation call, but we just swallow the error
        try:
            return self.pages_strategy.get_page_script(fallback_page_hash)
        except NotImplementedError:
            return None

    def populate_app_pages(self, proto: NewSession | PagesChanged):
        self.pages_strategy.populate_app_pages(proto)

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

    def get_page_script_byte_code(self, script_path: str) -> Any:
        if self._script_cache is None:
            # Returning an empty string for an empty script
            return ""

        return self._script_cache.get_bytecode(script_path)
