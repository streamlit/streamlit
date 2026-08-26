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

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from streamlit.runtime.pages_manager import PagesManager
    from streamlit.source_util import PageInfo


def maybe_trim_page_path(url: str, page_manager: PagesManager) -> str:
    """Trim the page path from the URL if it exists."""
    url = url.removesuffix("/")

    for page in page_manager.get_pages().values():
        page_url = page.get("url_pathname", "")
        if page_url and url.endswith(page_url):
            return url.removesuffix(page_url)

    return url


def maybe_add_page_path(url: str, page_manager: PagesManager) -> str:
    """Add the page path to the URL if it exists."""
    url = url.removesuffix("/")

    current_page_script_hash = page_manager.current_page_script_hash
    current_page_info: PageInfo | None = page_manager.get_pages().get(
        current_page_script_hash, None
    )
    if current_page_info is not None:
        page_url = current_page_info.get("url_pathname", "")
        if page_url:
            return f"{url}/{page_url}"

    return url
