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
    from enum import Enum

    from streamlit.elements.widgets.selectbox import SelectboxMixin

    selectbox = SelectboxMixin().selectbox

    class Alfred(Enum):
        HITCHCOCK = 1
        WALLACE = 2
        GREENE = 3

    # ty infers `Unknown` for empty options.
    assert_type(selectbox("foo", []), None)  # ty: ignore[type-assertion-failure]
    # ty infers `Unknown | str` when options are empty and accept_new_options=True.
    assert_type(selectbox("foo", [], accept_new_options=True), str)  # ty: ignore[type-assertion-failure]

    assert_type(selectbox("foo", [1, 2, 3]), int)
    assert_type(selectbox("foo", [1, 2, 3], index=None), int | None)
    # ty infers `float*` (not equivalent to `float`).
    assert_type(selectbox("foo", [1.0, 2.0, 3.0]), float)  # ty: ignore[type-assertion-failure]
    assert_type(selectbox("foo", [1.0, 2.0, 3.0], index=None), float | None)
    assert_type(selectbox("foo", [1.0, 2, 3.0]), float)
    assert_type(selectbox("foo", [1.0, 2, 3.0], index=None), float | None)
    assert_type(selectbox("foo", ["foo", "bar"]), str)
    assert_type(selectbox("foo", ["foo", "bar"], index=None), str | None)
    assert_type(selectbox("foo", Alfred), Alfred)
    assert_type(selectbox("foo", [Alfred.HITCHCOCK, Alfred.GREENE]), Alfred)
    assert_type(selectbox("foo", Alfred, index=None), Alfred | None)
    # ty infers `int | Alfred | str | None` rather than `object`.
    assert_type(selectbox("foo", [1, Alfred.HITCHCOCK, "five"], index=None), object)  # ty: ignore[type-assertion-failure]

    # Non-literal index: int | None. mypy expands the union, so these
    # assertions pass even without the dedicated overload in selectbox.py;
    # that overload exists for checkers that do not expand (e.g. pyrefly).
    # CI (mypy) cannot catch a regression if that overload is deleted.
    dynamic_index: int | None = None
    assert_type(selectbox("foo", [1, 2, 3], index=dynamic_index), int | None)
    assert_type(
        selectbox("foo", [1, 2, 3], index=dynamic_index, accept_new_options=False),
        int | None,
    )
    assert_type(
        selectbox("foo", [1, 2, 3], index=dynamic_index, accept_new_options=True),
        int | str | None,
    )
    assert_type(
        selectbox("foo", [1, 2, 3], index=0, accept_new_options=True), int | str
    )
    assert_type(
        selectbox("foo", [1, 2, 3], index=None, accept_new_options=True),
        int | str | None,
    )
    assert_type(
        selectbox("foo", ["foo", "bar"], index=None, accept_new_options=True),
        str | None,
    )
    accept_new_options = True
    assert_type(
        selectbox(
            "foo",
            [Alfred.HITCHCOCK, Alfred.GREENE],
            index=None,
            accept_new_options=accept_new_options,
        ),
        Alfred | str | None,
    )
    assert_type(selectbox("foo", ["foo", "bar"], filter_mode="contains"), str)
    assert_type(selectbox("foo", ["foo", "bar"], filter_mode=None), str)
    assert_type(
        selectbox("foo", ["foo", "bar"], index=None, filter_mode=None), str | None
    )

    # Check bind parameter
    assert_type(selectbox("foo", ["a", "b"], bind="query-params"), str)
    assert_type(selectbox("foo", [1, 2, 3], bind="query-params"), int)
    assert_type(selectbox("foo", ["a", "b"], bind=None), str)
    assert_type(
        selectbox("foo", ["a", "b"], index=None, bind="query-params"), str | None
    )

    # Check persist_state parameter
    assert_type(selectbox("foo", ["a", "b"], persist_state="page"), str)
    assert_type(selectbox("foo", [1, 2, 3], persist_state="session"), int)
    assert_type(selectbox("foo", ["a", "b"], persist_state=None), str)
    assert_type(
        selectbox("foo", ["a", "b"], index=None, persist_state="session"), str | None
    )

    def on_selectbox_change(prefix: str) -> None: ...

    # Common parameters combined
    assert_type(
        selectbox(
            "foo",
            [1, 2, 3],
            format_func=lambda value: f"Option {value}",
            key="choice",
            help="Choose one",
            on_change=on_selectbox_change,
            args=("choice",),
            kwargs={},
            placeholder="Select a number",
            disabled=False,
            label_visibility="visible",
            width=320,
        ),
        int,
    )
