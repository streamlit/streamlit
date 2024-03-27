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
    page: Path | Callable[[], None]
    title: str | None = None
    icon: str | None = None
    default: bool = False
    key: str | None = None

    def __init__(
        self,
        page: str | Path | Callable[[], None],
        *,
        title: str | None = None,
        icon: str | None = None,
        default: bool = False,
        key: str | None = None,
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
            inferred_name = page.__name__

        name = title or inferred_name
        assert name

        self.page = page
        self.title = title or inferred_name
        self.icon = icon or inferred_icon
        self.default = default
        self.key = key

    def run(self) -> None:
        ctx = get_script_run_ctx()
        assert ctx and ctx.script_requests

        ctx.script_requests.request_page_run(self)
        ctx.yield_callback()

    @property
    def _script_hash(self) -> str:
        if isinstance(self.page, Page):
            h = calc_md5(str(self.page))
        else:
            assert self.title
            h = calc_md5(self.title)
        print(f"{self.title=} {h}")
        return h


def navigation(
    pages: list[Page] | dict[str, list[Page]],
    *,
    position: Literal["sidebar"] | Literal["hidden"] = "sidebar",
) -> Page:
    ctx = get_script_run_ctx()
    assert ctx

    pgs = Pages(pages)

    defaults = [page for page in pgs.page_list if page.default]
    if len(defaults) > 1:
        raise StreamlitAPIException("At most one page can be the default")
    if len(defaults) == 0:
        pgs.page_list[0].default = True

    msg = ForwardMsg()
    for section in pgs.page_dict:
        nav_section = msg.navigation.sections.add()
        nav_section.header = section
        for page in pgs.page_dict[section]:
            p = nav_section.app_pages.add()
            p.page_script_hash = page._script_hash
            p.page_name = page.title or ""
            p.icon = page.icon or ""

    ctx.enqueue(msg)

    page_dict = {}
    for page in pgs.page_list:
        page_dict[page._script_hash] = page
    ctx.pages = page_dict
    try:
        page = page_dict[ctx.page_script_hash]
    except KeyError:
        print(f"{page_dict=}")
        print(
            f"could not find page for {ctx.page_script_hash}, falling back to default page"
        )
        page = pgs.default
    return page


class Pages:
    def __init__(self, pages: list[Page] | dict[str, list[Page]]):
        if isinstance(pages, list):
            self._pages: dict[str, list[Page]] = {"": pages}
        else:
            self._pages = pages

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

    @property
    def default(self) -> Page:
        return [page for page in self.page_list if page.default][0]
