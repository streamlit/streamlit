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

import streamlit as st
from streamlit.runtime.scriptrunner.script_run_context import get_script_run_ctx
from streamlit.util import calc_md5


@dataclass
class Page:
    page: Path | Callable
    title: str | None = None
    icon: str | None = None
    default: bool = False
    key: str | None = None

    def __init__(
        self,
        page: str | Path | Callable,
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
        self.page = page
        self.title = title
        self.icon = icon
        self.default = default
        self.key = key

    def run(self) -> None:
        ctx = get_script_run_ctx()
        assert ctx and ctx.script_requests

        ctx.script_requests.request_page_run(self)
        ctx.yield_callback()

    @property
    def _script_hash(self) -> str:
        h = calc_md5(str(self.page))
        return h


def navigation(
    pages: list[Page],  # | dict[str, list[Page]],
    *,
    position: Literal["sidebar"] | Literal["hidden"] = "sidebar",
) -> Page:
    ctx = get_script_run_ctx()
    assert ctx

    page_dict = {page._script_hash: page for page in pages}
    ctx.pages = page_dict
    try:
        page = page_dict[ctx.page_script_hash]
    except KeyError:
        page = pages[0]
    # psh = ctx.page_script_hash
    # idx = [page._script_hash for page in pages].index(psh)
    # page = pages[idx]
    return page
