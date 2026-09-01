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
    from contextlib import AbstractContextManager

    from streamlit.elements.spinner import SpinnerMixin

    spinner = SpinnerMixin().spinner

    # =====================================================================
    # st.spinner return type tests
    # =====================================================================

    # Basic usage - context manager that yields None
    ctx: AbstractContextManager[None] = spinner()
    with spinner() as result:
        assert_type(result, None)

    with spinner("In progress...") as result:
        assert_type(result, None)

    # Text parameter
    ctx = spinner("Loading data")
    ctx = spinner(text="Processing...")

    # show_time parameter (keyword-only)
    ctx = spinner("Wait...", show_time=True)
    ctx = spinner("Wait...", show_time=False)

    # width parameter - "content" literal (default)
    ctx = spinner("Wait...", width="content")

    # width parameter - "stretch" literal
    ctx = spinner("Wait...", width="stretch")

    # width parameter - int (pixels)
    ctx = spinner("Wait...", width=200)
    ctx = spinner("Wait...", width=400)

    # All public parameters combined
    ctx = spinner(
        "Wait for it...",
        show_time=True,
        width="stretch",
    )

    with spinner("Loading...", show_time=False, width=300) as result:
        assert_type(result, None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid text type (not str)
    spinner(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    spinner(text=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid show_time type (not bool)
    spinner("Wait...", show_time="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing show_time as positional argument (should be keyword-only)
    spinner("Wait...", True)  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Invalid width value (not "content", "stretch", or int)
    spinner("Wait...", width="full")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    spinner("Wait...", width=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
