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

    from streamlit.elements.widgets.multiselect import MultiSelectMixin

    multiselect = MultiSelectMixin().multiselect

    class Alfred(Enum):
        HITCHCOCK = 1
        WALLACE = 2
        GREENE = 3

    # Basic type tests without accept_new_options
    assert_type(multiselect("foo", [1, 2, 3]), list[int])
    assert_type(multiselect("foo", [1, 2, 3], default=None), list[int])
    assert_type(multiselect("foo", [1.0, 2.0, 3.0]), list[float])
    assert_type(multiselect("foo", [1.0, 2.0, 3.0], default=None), list[float])
    assert_type(multiselect("foo", [1.0, 2, 3.0]), list[float])
    assert_type(multiselect("foo", [1.0, 2, 3.0], default=None), list[float])
    assert_type(multiselect("foo", ["foo", "bar"]), list[str])
    assert_type(multiselect("foo", ["foo", "bar"], default=None), list[str])
    assert_type(multiselect("foo", Alfred), list[Alfred])
    assert_type(multiselect("foo", [Alfred.HITCHCOCK, Alfred.GREENE]), list[Alfred])
    assert_type(multiselect("foo", [1, Alfred.HITCHCOCK, "five"]), list[object])

    # Tests with accept_new_options=True
    assert_type(multiselect("foo", [1, 2, 3], accept_new_options=True), list[int | str])
    assert_type(
        multiselect("foo", [1, 2, 3], default=None, accept_new_options=True),
        list[int | str],
    )
    assert_type(
        multiselect("foo", [1.0, 2.0, 3.0], accept_new_options=True),
        list[float | str],
    )
    assert_type(multiselect("foo", ["foo", "bar"], accept_new_options=True), list[str])
    assert_type(multiselect("foo", Alfred, accept_new_options=True), list[Alfred | str])
    assert_type(
        multiselect("foo", [Alfred.HITCHCOCK, Alfred.GREENE], accept_new_options=True),
        list[Alfred | str],
    )

    # Tests with default values
    assert_type(multiselect("foo", [1, 2, 3], default=[1]), list[int])
    assert_type(multiselect("foo", [1, 2, 3], default=1), list[int])
    assert_type(multiselect("foo", ["foo", "bar"], default=["foo"]), list[str])
    assert_type(multiselect("foo", ["foo", "bar"], default="foo"), list[str])
    assert_type(multiselect("foo", Alfred, default=[Alfred.HITCHCOCK]), list[Alfred])
    assert_type(multiselect("foo", Alfred, default=Alfred.HITCHCOCK), list[Alfred])

    # Tests with default values and accept_new_options
    assert_type(
        multiselect("foo", [1, 2, 3], default=[1], accept_new_options=True),
        list[int | str],
    )
    assert_type(
        multiselect("foo", [1, 2, 3], default=1, accept_new_options=True),
        list[int | str],
    )
    assert_type(
        multiselect("foo", ["foo", "bar"], default=["foo"], accept_new_options=True),
        list[str],
    )
    assert_type(
        multiselect("foo", ["foo", "bar"], default="foo", accept_new_options=True),
        list[str],
    )
    assert_type(
        multiselect("foo", Alfred, default=[Alfred.HITCHCOCK], accept_new_options=True),
        list[Alfred | str],
    )
    assert_type(
        multiselect("foo", Alfred, default=Alfred.HITCHCOCK, accept_new_options=True),
        list[Alfred | str],
    )

    # Check bind parameter
    assert_type(multiselect("foo", ["a", "b"], bind="query-params"), list[str])
    assert_type(multiselect("foo", [1, 2, 3], bind="query-params"), list[int])
    assert_type(multiselect("foo", ["a", "b"], bind=None), list[str])
    assert_type(
        multiselect("foo", ["a", "b"], bind="query-params", accept_new_options=True),
        list[str],
    )

    # Check search_type parameter
    assert_type(multiselect("foo", ["a", "b"], search_type="fuzzy"), list[str])
    assert_type(multiselect("foo", ["a", "b"], search_type="exact"), list[str])
    assert_type(multiselect("foo", ["a", "b"], search_type="contains"), list[str])
    assert_type(multiselect("foo", ["a", "b"], search_type="startswith"), list[str])
    assert_type(multiselect("foo", [1, 2, 3], search_type="contains"), list[int])
    assert_type(
        multiselect("foo", ["a", "b"], search_type="exact", accept_new_options=True),
        list[str],
    )

    # Check group-* search_type parameter
    assert_type(multiselect("foo", ["a", "b"], search_type="group-fuzzy"), list[str])
    assert_type(multiselect("foo", ["a", "b"], search_type="group-exact"), list[str])
    assert_type(multiselect("foo", ["a", "b"], search_type="group-contains"), list[str])
    assert_type(
        multiselect("foo", ["a", "b"], search_type="group-startswith"), list[str]
    )

    # Check group-* search_type with grouped dict options
    assert_type(
        multiselect(
            "foo",
            {"G1": ["a", "b"], "G2": ["c"]},
            search_type="group-fuzzy",
        ),
        list[str],
    )
    assert_type(
        multiselect(
            "foo",
            {"G1": [1, 2], "G2": [3]},
            search_type="group-contains",
        ),
        list[int],
    )
    assert_type(
        multiselect(
            "foo",
            {"G1": ["a"], "G2": ["b"]},
            search_type="group-exact",
            accept_new_options=True,
        ),
        list[str],
    )

    # Check grouped dict options
    assert_type(
        multiselect("foo", {"G1": ["a", "b"], "G2": ["c"]}),
        list[str],
    )
    assert_type(
        multiselect("foo", {"G1": [1, 2], "G2": [3]}),
        list[int],
    )
    assert_type(
        multiselect("foo", {"G1": ["a"], "G2": ["b"]}, accept_new_options=True),
        list[str],
    )
    assert_type(
        multiselect("foo", {"G1": [1, 2]}, accept_new_options=True),
        list[int | str],
    )
    assert_type(
        multiselect("foo", {"G1": ["a", "b"]}, default=["a"]),
        list[str],
    )
