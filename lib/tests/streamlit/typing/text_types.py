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
    from streamlit.elements.text import TextMixin

    text = TextMixin().text

    # =====================================================================
    # st.text return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(text("Hello, world!"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(text(42), DeltaGenerator)

    # Text with help parameter (keyword-only)
    assert_type(text("Text", help="This is help text"), DeltaGenerator)
    assert_type(text("Text", help=None), DeltaGenerator)

    # Text with width parameter (keyword-only)
    assert_type(text("Text", width="content"), DeltaGenerator)
    assert_type(text("Text", width="stretch"), DeltaGenerator)
    assert_type(text("Text", width=300), DeltaGenerator)

    # Text with text_alignment parameter (keyword-only)
    assert_type(text("Text", text_alignment="left"), DeltaGenerator)
    assert_type(text("Text", text_alignment="center"), DeltaGenerator)
    assert_type(text("Text", text_alignment="right"), DeltaGenerator)
    assert_type(text("Text", text_alignment="justify"), DeltaGenerator)

    # Text with all parameters combined
    assert_type(
        text(
            "Important notice",
            help="Additional information",
            width="stretch",
            text_alignment="center",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch", "content", or int)
    text("Text", width="invalid")  # type: ignore[arg-type]

    # Invalid text_alignment value (not "left", "center", "right", or "justify")
    text("Text", text_alignment="start")  # type: ignore[arg-type]

    # Passing help as positional argument (should be keyword-only)
    text("Text", "help text")  # type: ignore[misc]
