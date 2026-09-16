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

    from streamlit.commands.echo import echo

    # =====================================================================
    # st.echo return type tests
    # =====================================================================

    # Basic usage - context manager that yields None
    ctx: AbstractContextManager[None] = echo()
    with echo() as result:
        assert_type(result, None)

    # code_location "above" (default) - positional and keyword
    ctx = echo("above")
    ctx = echo(code_location="above")
    with echo("above") as result:
        assert_type(result, None)

    # code_location "below" - positional and keyword
    ctx = echo("below")
    ctx = echo(code_location="below")
    with echo(code_location="below") as result:
        assert_type(result, None)

    # All public parameters combined
    ctx = echo(code_location="above")
    with echo(code_location="below") as result:
        assert_type(result, None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid code_location literal (not "above" or "below")
    echo("side")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    echo(code_location="side")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid code_location type
    echo(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    echo(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    echo(code_location=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Unknown argument
    echo(width="stretch")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    # Too many positional arguments
    echo("above", "below")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
