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

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are incorrect.
if TYPE_CHECKING:
    from streamlit.elements.widgets.breadcrumbs import BreadcrumbsMixin

    breadcrumbs = BreadcrumbsMixin().breadcrumbs

    # Test basic return type - T | None
    assert_type(breadcrumbs(["Home", "Section", "Page"]), str | None)
    assert_type(breadcrumbs([1, 2, 3]), int | None)
    assert_type(breadcrumbs([1.0, 2.0, 3.0]), float | None)

    # Test with custom objects - returns dict | None
    items = [{"id": "home"}, {"id": "section"}]
    assert_type(breadcrumbs(items), dict[str, str] | None)

    # Test key parameter
    assert_type(breadcrumbs(["a", "b"], key="my_key"), str | None)
    assert_type(breadcrumbs(["a", "b"], key=123), str | None)

    # Test help parameter
    assert_type(breadcrumbs(["a", "b"], help="tooltip text"), str | None)
    assert_type(breadcrumbs(["a", "b"], help=None), str | None)

    # Test disabled parameter
    assert_type(breadcrumbs(["a", "b"], disabled=True), str | None)
    assert_type(breadcrumbs(["a", "b"], disabled=False), str | None)

    # Test separator parameter
    assert_type(breadcrumbs(["a", "b"], separator=" > "), str | None)
    assert_type(
        breadcrumbs(["a", "b"], separator=":material/chevron_right:"), str | None
    )

    # Test on_click parameter
    def my_callback() -> None:
        pass

    assert_type(breadcrumbs(["a", "b"], on_click=my_callback), str | None)
    assert_type(breadcrumbs(["a", "b"], on_click=None), str | None)

    # Test format_func parameter
    def format_item(item: str) -> str:
        return f":material/home: {item}"

    assert_type(breadcrumbs(["a", "b"], format_func=format_item), str | None)
    assert_type(breadcrumbs(["a", "b"], format_func=None), str | None)
