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

from dataclasses import dataclass
from pathlib import Path
from typing import Callable, Literal

from streamlit.errors import StreamlitAPIException
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.scriptrunner.script_run_context import get_script_run_ctx
from streamlit.source_util import page_icon_and_name
from streamlit.util import calc_md5


@dataclass
class Page:
    _page: Path | Callable[[], None]
    title: str | None = None
    icon: str | None = None
    default: bool = False

    def __init__(
        self,
        page: str | Path | Callable[[], None],
        *,
        title: str | None = None,
        icon: str | None = None,
        default: bool = False,
    ):
        ctx = get_script_run_ctx()
        assert ctx

        main_path = Path(ctx.main_script_path).parent
        if isinstance(page, str):
            page = Path(page)
        if isinstance(page, Path):
            page = (main_path / page).resolve()

        inferred_name = ""
        inferred_icon = ""
        if isinstance(page, Path):
            inferred_icon, inferred_name = page_icon_and_name(page)
        else:
            # A this point page can only be a callable
            if not page.__name__:
                raise StreamlitAPIException(
                    "Cannot infer page name from callable page. Please provide a title."
                )

            inferred_name = page.__name__

        name = title or inferred_name
        assert name

        self._page = page
        self.title = title or inferred_name
        self.icon = icon or inferred_icon
        self.default = default

    def run(self) -> None:
        ctx = get_script_run_ctx()
        assert ctx

        ex = None
        with ctx.pages_manager.run_with_active_hash(self._script_hash):
            try:
                if callable(self._page):
                    self._page()
                    return

                with open(self._page, "r") as file:
                    script_content = file.read()

                # TODO(kmcgrady): Needs more thought, but it's a good start
                exec_globals = {"__file__": self._page}
                exec(script_content, exec_globals)
            except Exception as e:
                # Catch the exception so we can raise it after we've reset the active page
                ex = e

        if ex:
            raise ex

    @property
    def _script_hash(self) -> str:
        if isinstance(self._page, Page):
            h = calc_md5(str(self._page))
        else:
            assert self.title
            h = calc_md5(self.title)
        return h


def navigation(
    pages: list[Page] | dict[str, list[Page]],
    *,
    position: Literal["sidebar"] | Literal["hidden"] = "sidebar",
) -> Page:
    ctx = get_script_run_ctx()
    assert ctx

    pgs = Pages(pages)

    page_list = pgs.page_list
    defaults = [page for page in page_list if page.default]

    # First assume the first page is the default. We will update this if
    # we detect that a different page is the default.
    default_page = page_list[0]
    if len(defaults) > 1:
        raise StreamlitAPIException("At most one page can be the default")
    if len(defaults) == 0:
        default_page.default = True
    else:
        default_page = defaults[0]

    msg = ForwardMsg()
    msg.navigation.position = position
    for section in pgs.page_dict:
        nav_section = msg.navigation.sections.add()
        nav_section.header = section
        for page in pgs.page_dict[section]:
            p = nav_section.app_pages.add()
            p.page_script_hash = page._script_hash
            p.page_name = page.title or ""
            p.icon = page.icon or ""
            p.is_default = page.default

    # Inform our page manager about the set of pages we have
    ctx.pages_manager.set_pages(pgs.as_pages_dict())
    page_script_hash = ctx.pages_manager.get_current_page_script_hash()

    try:
        # TODO(kmcgrady): Handle page name/url path as well
        page = pgs.get_page_by_hash(page_script_hash)
    except KeyError:
        print(
            f"could not find page for {page_script_hash}, falling back to default page"
        )
        page = default_page
    msg.navigation.page_script_hash = page._script_hash

    ctx.enqueue(msg)
    return page


@dataclass
class Pages:
    _pages: dict[str, list[Page]]

    def __init__(self, pages: list[Page] | dict[str, list[Page]]):
        if isinstance(pages, list):
            self._pages = {"": pages}
        else:
            self._pages = pages

    def get_page_by_hash(self, hash: str) -> Page:
        for page in self.page_list:
            if page._script_hash == hash:
                return page

        raise KeyError(f"Page with hash {hash} not found")

    @property
    def page_dict(self) -> dict[str, list[Page]]:
        return self._pages

    @property
    def page_list(self) -> list[Page]:
        page_list = []
        for pgs in self._pages.values():
            for page in pgs:
                page_list.append(page)

        return page_list

    def as_pages_dict(self) -> dict[str, dict[str, str]]:
        d = {}
        for page in self.page_list:
            if isinstance(page._page, Path):
                script_path = str(page._page)
            else:
                script_path = ""
            d[page._script_hash] = {
                "page_script_hash": page._script_hash,
                "page_name": page.title,
                "icon": page.icon,
                "script_path": script_path,
            }
        return d
