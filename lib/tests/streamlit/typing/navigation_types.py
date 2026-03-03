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

from typing import TYPE_CHECKING, Literal

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
if TYPE_CHECKING:
    from pathlib import Path

    from streamlit.commands.navigation import navigation
    from streamlit.navigation.page import Page

    # Test basic list input
    assert_type(navigation(["page1.py"]), Page)
    assert_type(navigation([Path("page1.py")]), Page)

    # Test dictionary input with sections
    assert_type(
        navigation(
            {"Section 1": ["page1.py", "page2.py"], "Section 2": [Path("page3.py")]}
        ),
        Page,
    )

    # Test with Page objects
    page1 = Page("page1.py")
    page2 = Page("page2.py")
    assert_type(navigation([page1, page2]), Page)

    # Test with callable functions
    def page_func() -> None:
        pass

    assert_type(navigation([page_func]), Page)

    # Test with mixed types in a dictionary
    assert_type(
        navigation(
            {
                "Section 1": ["page1.py", Path("page2.py"), page1, page_func],
                "Section 2": [page2],
            }
        ),
        Page,
    )

    # Test with mixed types in a list
    assert_type(
        navigation(["page1.py", Path("page2.py"), page1, page_func]),
        Page,
    )

    # Test with position and expanded parameters
    assert_type(navigation(["page1.py"], position="sidebar", expanded=True), Page)
    assert_type(navigation(["page1.py"], position="hidden", expanded=False), Page)
    # Test expanded with integer values
    assert_type(navigation(["page1.py"], expanded=5), Page)
    assert_type(navigation(["page1.py"], expanded=0), Page)

    # Test Page with visibility parameter
    visible_page = Page("page.py", visibility="visible")
    hidden_page = Page("page.py", visibility="hidden")
    assert_type(visible_page, Page)
    assert_type(hidden_page, Page)

    # Test visibility property returns correct Literal type
    assert_type(visible_page.visibility, Literal["visible", "hidden"])
