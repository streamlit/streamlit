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

"""Typing tests for st.skeleton().

These tests are checked by mypy, not executed at runtime.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from typing_extensions import assert_type

    from streamlit.elements.lib.skeleton_placeholder import SkeletonPlaceholder
    from streamlit.elements.skeleton import SkeletonMixin

    dg = SkeletonMixin()

    # Test return type
    assert_type(dg.skeleton(), SkeletonPlaceholder)
    assert_type(dg.skeleton(height=None), SkeletonPlaceholder)
    assert_type(dg.skeleton(100), SkeletonPlaceholder)
    assert_type(dg.skeleton(height=100), SkeletonPlaceholder)
    assert_type(dg.skeleton(height="stretch"), SkeletonPlaceholder)
    assert_type(dg.skeleton(width=200), SkeletonPlaceholder)
    assert_type(dg.skeleton(width="stretch"), SkeletonPlaceholder)
    assert_type(dg.skeleton(height=100, width=200), SkeletonPlaceholder)
    assert_type(dg.skeleton(height="stretch", width="stretch"), SkeletonPlaceholder)

    # Test delegated method types - __getattr__ returns Any, which allows
    # calling DeltaGenerator methods on the placeholder. Since Any is returned,
    # the return type of delegated methods is also Any.
    placeholder = dg.skeleton()
    # Delegated methods should be callable (no type error).
    # With __getattr__ -> Any, these calls type-check correctly.
    placeholder.empty()
    placeholder.markdown("hello")
    placeholder.dataframe({"col": [1, 2, 3]})
