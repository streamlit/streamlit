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
import threading
from pathlib import Path
from typing import Callable, Final

from blinker import Signal

from streamlit.logger import get_logger
from streamlit.source_util import page_icon_and_name, page_sort_key
from streamlit.util import calc_md5
from streamlit.watcher import watch_dir

_LOGGER: Final = get_logger(__name__)


class V1PagesManager:
    is_watching_pages_dir: bool = False

    def __init__(self, parent):
        self._parent = parent
        self._current_page_hash = self._parent.main_script_hash
        V1PagesManager._watch_pages_dir(self._parent)

    # This is a static method because we only want to watch the pages directory
    # once on initial load.
    @staticmethod
    def _watch_pages_dir(pages_manager):
        if V1PagesManager.is_watching_pages_dir:
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
        V1PagesManager.is_watching_pages_dir = True

    def get_main_page(self):
        return {
            "script_path": self._parent.main_script_path,
            "script_hash": self._parent.main_script_hash,
        }

    def get_active_page_script_hash(self):
        return self._current_page_hash

    def get_current_page_script_hash(self):
        return self._current_page_hash

    def set_active_page_script_hash(self, _):
        raise NotImplementedError(
            "Cannot set active page in version 1 of multipage apps."
        )

    def set_current_page_script_hash(self, page_hash):
        self._current_page_hash = page_hash

    def get_page_by_run(self, page_script_hash, page_name):
        pages = self.get_pages()
        # Safe because pages will at least contain the app's main page.
        main_page_info = list(pages.values())[0]

        if page_script_hash:
            current_page_info = pages.get(page_script_hash, None)
        elif not page_script_hash and page_name:
            # If a user navigates directly to a non-main page of an app, we get
            # the first script run request before the list of pages has been
            # sent to the frontend. In this case, we choose the first script
            # with a name matching the requested page name.
            current_page_info = next(
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
        else:
            # If no information about what page to run is given, default to
            # running the main page.
            current_page_info = main_page_info

        # TODO(kmcgrady): I don't like this, but it simplifies the logic
        if current_page_info is not None:
            self._parent.set_current_page_script_hash(current_page_info["script_hash"])

        return current_page_info

    def get_pages(self) -> dict[str, dict[str, str]]:
        main_script_path = Path(self._parent.main_script_path)
        main_script_hash = self._parent.main_script_hash
        main_page_icon, main_page_name = page_icon_and_name(main_script_path)

        # NOTE: We include the page_script_hash in the dict even though it is
        #       already used as the key because that occasionally makes things
        #       easier for us when we need to iterate over pages.
        pages = {
            main_script_hash: {
                "script_hash": main_script_hash,
                "page_name": main_page_name,
                "icon": main_page_icon,
                "script_path": str(main_script_path.resolve()),
            }
        }
        pages_dir = main_script_path.parent / "pages"
        page_scripts = sorted(
            [
                f
                for f in pages_dir.glob("*.py")
                if not f.name.startswith(".") and not f.name == "__init__.py"
            ],
            key=page_sort_key,
        )
        for script_path in page_scripts:
            script_path_str = str(script_path.resolve())
            pi, pn = page_icon_and_name(script_path)
            psh = calc_md5(script_path_str)
            pages[psh] = {
                "script_hash": psh,
                "page_name": pn,
                "icon": pi,
                "script_path": script_path_str,
            }

        return pages

    def set_pages(self, _):
        raise NotImplementedError("Cannot set pages in version 1 of multipage apps.")


class V2PagesManager:
    def __init__(self, parent):
        self._parent = parent
        self._pages = None
        self._current_page_hash = self._parent.main_script_hash
        self._active_page_hash = self._parent.main_script_hash

    def get_main_page(self):
        return {
            "script_path": self._parent.main_script_path,
            "script_hash": self._parent.main_script_hash,  # Default Hash
        }

    def get_active_page_script_hash(self):
        return self._active_page_hash

    def get_current_page_script_hash(self):
        return self._current_page_hash

    def set_active_page_script_hash(self, page_hash):
        self._active_page_hash = page_hash

    def set_current_page_script_hash(self, page_hash):
        self._current_page_hash = page_hash

    def get_page_by_run(self, page_script_hash, page_name):
        pages = self.get_pages()
        page_hash = None
        if page_script_hash:
            page_hash = page_script_hash
        elif not page_script_hash and page_name:
            # If a user navigates directly to a non-main page of an app, we get
            # the first script run request before the list of pages has been
            # sent to the frontend. In this case, we choose the first script
            # with a name matching the requested page name.
            current_page_info = next(
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
            if current_page_info:
                page_hash = current_page_info["page_script_hash"]

        return {
            # We always run the main script in V2 as it's the common code
            "script_path": self._parent.main_script_path,
            "script_hash": page_hash or "",  # Default Hash
        }

    def get_pages(self):
        return self._pages or {
            self._parent.main_script_hash: {
                "script_hash": self._parent.main_script_hash,
                "page_name": "",
                "icon": "",
                "script_path": self._parent.main_script_path,
            }
        }

    def set_pages(self, pages):
        self._pages = pages


class PagesManager:
    _cached_pages: dict[str, dict[str, str]] | None = None
    _pages_cache_lock = threading.RLock()
    _on_pages_changed = Signal(doc="Emitted when the set of pages has changed")

    def __init__(self, main_script_path):
        self._main_script_path = main_script_path
        self._main_script_hash = calc_md5(main_script_path)
        self._version_manager = V1PagesManager(self)

    @property
    def main_script_hash(self):
        return self._main_script_hash

    @property
    def main_script_path(self):
        return self._main_script_path

    def get_main_page(self):
        return self._version_manager.get_main_page()

    def get_current_page_script_hash(self):
        return self._version_manager.get_current_page_script_hash()

    def set_current_page_script_hash(self, page_hash):
        self._version_manager.set_current_page_script_hash(page_hash)

    def get_active_page_script_hash(self):
        return self._version_manager.get_active_page_script_hash()

    def set_active_page_script_hash(self, page_hash):
        self._version_manager.set_active_page_script_hash(page_hash)

    @contextlib.contextmanager
    def run_with_active_hash(self, page_hash):
        original_page_hash = self.get_active_page_script_hash()
        self.set_active_page_script_hash(page_hash)
        yield
        self.set_active_page_script_hash(original_page_hash)

    def get_page_by_run(self, page_script_hash, page_name):
        return self._version_manager.get_page_by_run(page_script_hash, page_name)

    def get_pages(self) -> dict[str, dict[str, str]]:
        # Avoid taking the lock if the pages cache hasn't been invalidated.
        pages = self._cached_pages
        if pages is not None:
            return pages

        with self._pages_cache_lock:
            # The cache may have been repopulated while we were waiting to grab
            # the lock.
            if self._cached_pages is not None:
                return self._cached_pages

            pages = self._version_manager.get_pages()
            self._cached_pages = pages

            return pages

    def set_pages(self, pages):
        try:
            vm_pages = self._version_manager.set_pages(pages)
        except NotImplementedError:
            _LOGGER.warning(
                "We've detected a call to st.navigation in a script that has a pages directory."
            )
            self._version_manager = V2PagesManager(self)
            self.invalidate_pages_cache()
            vm_pages = self._version_manager.set_pages(pages)

        self._cached_pages = vm_pages
        self._on_pages_changed.send()

    def invalidate_pages_cache(self) -> None:
        _LOGGER.debug("Pages directory changed")
        with self._pages_cache_lock:
            self._cached_pages = None

        self._on_pages_changed.send()

    def register_pages_changed_callback(
        self,
        callback: Callable[[str], None],
    ) -> Callable[[], None]:
        def disconnect():
            self._on_pages_changed.disconnect(callback)

        # weak=False so that we have control of when the pages changed
        # callback is deregistered.
        self._on_pages_changed.connect(callback, weak=False)

        return disconnect
