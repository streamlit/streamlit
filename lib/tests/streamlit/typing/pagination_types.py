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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.elements.widgets.pagination import PaginationMixin

    pagination = PaginationMixin().pagination

    # =====================================================================
    # st.pagination return type tests
    # =====================================================================

    # Basic pagination - returns int
    assert_type(pagination(num_pages=10), int)
    assert_type(pagination(10), int)

    # Pagination with default parameter
    assert_type(pagination(10, default=1), int)
    assert_type(pagination(10, default=5), int)

    # Pagination with key parameter - str or int
    assert_type(pagination(10, key="my_pagination"), int)
    assert_type(pagination(10, key=123), int)
    assert_type(pagination(10, key=None), int)

    # Pagination with max_visible_pages parameter - int or None
    assert_type(pagination(10, max_visible_pages=7), int)
    assert_type(pagination(10, max_visible_pages=0), int)
    assert_type(pagination(10, max_visible_pages=None), int)

    # Pagination with width parameter - "content", "stretch", or int
    assert_type(pagination(10, width="content"), int)
    assert_type(pagination(10, width="stretch"), int)
    assert_type(pagination(10, width=200), int)

    # Pagination with disabled parameter
    assert_type(pagination(10, disabled=True), int)
    assert_type(pagination(10, disabled=False), int)

    # Pagination with on_change callback
    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(pagination(10, on_change=my_callback), int)
    assert_type(pagination(10, on_change=callback_with_args, args=(1, "a")), int)
    assert_type(
        pagination(10, on_change=callback_with_args, kwargs={"x": 1, "y": "a"}), int
    )
    assert_type(pagination(10, on_change=None), int)

    # Pagination with all parameters combined
    assert_type(
        pagination(
            num_pages=10,
            default=1,
            max_visible_pages=7,
            width="content",
            key="full_pagination",
            on_change=my_callback,
            args=None,
            kwargs=None,
            disabled=False,
        ),
        int,
    )
