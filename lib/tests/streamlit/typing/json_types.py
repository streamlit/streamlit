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

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.json import JsonMixin

    json = JsonMixin().json

    # =====================================================================
    # st.json return type tests
    # =====================================================================

    # Basic usage with dict - returns DeltaGenerator
    assert_type(json({"key": "value"}), DeltaGenerator)

    # Basic usage with string (pre-serialized JSON)
    assert_type(json('{"key": "value"}'), DeltaGenerator)

    # Basic usage with list
    assert_type(json([1, 2, 3]), DeltaGenerator)

    # Basic usage with nested data structure
    assert_type(json({"nested": {"deep": {"value": 123}}}), DeltaGenerator)

    # With expanded=True (default, fully expanded)
    assert_type(json({"data": "value"}, expanded=True), DeltaGenerator)

    # With expanded=False (fully collapsed)
    assert_type(json({"data": "value"}, expanded=False), DeltaGenerator)

    # With expanded as int (expand to specific depth)
    assert_type(json({"data": {"nested": "value"}}, expanded=2), DeltaGenerator)
    assert_type(json({"data": "value"}, expanded=0), DeltaGenerator)

    # With width="stretch" (default)
    assert_type(json({"data": "value"}, width="stretch"), DeltaGenerator)

    # With width as int (fixed pixel width)
    assert_type(json({"data": "value"}, width=300), DeltaGenerator)
    assert_type(json({"data": "value"}, width=500), DeltaGenerator)

    # All parameters combined
    assert_type(
        json(
            {"foo": "bar", "nested": {"level2": {"level3": "value"}}},
            expanded=2,
            width=400,
        ),
        DeltaGenerator,
    )

    assert_type(
        json(
            [1, 2, 3, {"key": "value"}],
            expanded=False,
            width="stretch",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch" or int)
    json({"data": "value"}, width="invalid")  # type: ignore[arg-type]

    # "content" is accepted by some sibling commands but NOT by st.json
    json({"data": "value"}, width="content")  # type: ignore[arg-type]

    # Invalid expanded type (not bool or int)
    json({"data": "value"}, expanded="true")  # type: ignore[arg-type]

    # Passing expanded as positional argument (should be keyword-only)
    json({"data": "value"}, True)  # type: ignore[misc]
