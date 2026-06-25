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
    from streamlit.elements.code import CodeMixin

    code = CodeMixin().code

    # =====================================================================
    # st.code return type tests
    # =====================================================================

    # Basic code - returns DeltaGenerator
    assert_type(code("print('Hello')"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(code(42), DeltaGenerator)

    # Code with language parameter (positional-or-keyword)
    assert_type(code("const x = 1", "javascript"), DeltaGenerator)
    assert_type(code("const x = 1", language="javascript"), DeltaGenerator)
    assert_type(code("plain text", None), DeltaGenerator)
    assert_type(code("plain text", language=None), DeltaGenerator)

    # Code with line_numbers parameter (keyword-only)
    assert_type(code("print('Hello')", line_numbers=True), DeltaGenerator)
    assert_type(code("print('Hello')", line_numbers=False), DeltaGenerator)

    # Code with wrap_lines parameter (keyword-only)
    assert_type(code("print('Hello')", wrap_lines=True), DeltaGenerator)
    assert_type(code("print('Hello')", wrap_lines=False), DeltaGenerator)

    # Code with height parameter (keyword-only)
    assert_type(code("print('Hello')", height="content"), DeltaGenerator)
    assert_type(code("print('Hello')", height="stretch"), DeltaGenerator)
    assert_type(code("print('Hello')", height=300), DeltaGenerator)
    assert_type(code("print('Hello')", height=None), DeltaGenerator)

    # Code with width parameter (keyword-only)
    assert_type(code("print('Hello')", width="stretch"), DeltaGenerator)
    assert_type(code("print('Hello')", width="content"), DeltaGenerator)
    assert_type(code("print('Hello')", width=400), DeltaGenerator)

    # Code with all parameters combined
    assert_type(
        code(
            "def hello():\n    print('Hello, Streamlit!')",
            "python",
            line_numbers=True,
            wrap_lines=False,
            height=200,
            width="stretch",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid height value (not "stretch", "content", or int)
    code("print('Hello')", height="auto")  # type: ignore[arg-type]

    # Invalid width value (not "stretch", "content", or int)
    code("print('Hello')", width="auto")  # type: ignore[arg-type]

    # Passing line_numbers as positional argument (should be keyword-only)
    code("print('Hello')", "python", True)  # type: ignore[misc]
