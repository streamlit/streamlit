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
    from streamlit.elements.widgets.button_group import ButtonGroupMixin

    pills = ButtonGroupMixin().pills

    options: list[int] = [1, 2, 3]
    assert_type(
        pills("foo", options),
        int | None,
    )
    assert_type(
        pills("foo", options, default=1),
        int | None,
    )
    assert_type(
        pills("foo", options, selection_mode="single"),
        int | None,
    )
    assert_type(
        pills("foo", options, selection_mode="single", default=1),
        int | None,
    )
    assert_type(
        pills("foo", options, selection_mode="multi"),
        list[int],
    )
    assert_type(
        pills("foo", options, selection_mode="multi", default=1),
        list[int],
    )
    assert_type(
        pills("foo", options, selection_mode="multi", default=[1]),
        list[int],
    )

    # Check bind parameter
    assert_type(pills("foo", options, bind="query-params"), int | None)
    assert_type(pills("foo", options, bind=None), int | None)
    assert_type(
        pills("foo", options, selection_mode="single", bind="query-params"),
        int | None,
    )
    assert_type(
        pills("foo", options, selection_mode="multi", bind="query-params"),
        list[int],
    )

    # Check required parameter with type narrowing
    assert_type(
        pills("foo", options, required=False),
        int | None,
    )
    assert_type(
        pills("foo", options, default=1, required=True),
        int,  # Guaranteed non-None because required=True with default set
    )
    assert_type(
        pills("foo", options, required=True),
        int | None,  # Can still be None initially (no default set)
    )
    assert_type(
        pills("foo", options, default=None, required=True),
        int | None,  # Explicitly None default still returns V | None
    )

    # Note: required=True with selection_mode="multi" is invalid and raises
    # StreamlitAPIException at runtime. This combination cannot be caught at
    # type-check time because the overload fallback accepts it. The validation
    # is enforced in _internal_button_group() at runtime.
