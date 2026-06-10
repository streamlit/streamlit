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
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.html import HtmlMixin

    html = HtmlMixin().html

    class _HtmlRepr:
        def _repr_html_(self) -> str:
            return "<p>repr</p>"

    # =====================================================================
    # st.html return type tests
    # =====================================================================

    # Basic usage with a string - returns DeltaGenerator
    assert_type(html("<p>Hello, world!</p>"), DeltaGenerator)

    # body accepts a Path
    assert_type(html(Path("index.html")), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(html(42), DeltaGenerator)

    # body accepts a SupportsReprHtml object (defines _repr_html_)
    assert_type(html(_HtmlRepr()), DeltaGenerator)

    # body accepts SupportsReprHtml (objects with a `_repr_html_` method)
    class _HtmlObj:
        def _repr_html_(self) -> str: ...

    assert_type(html(_HtmlObj()), DeltaGenerator)

    # html with width parameter (keyword-only)
    assert_type(html("<p>Text</p>", width="stretch"), DeltaGenerator)
    assert_type(html("<p>Text</p>", width="content"), DeltaGenerator)
    assert_type(html("<p>Text</p>", width=300), DeltaGenerator)

    # html with unsafe_allow_javascript parameter (keyword-only)
    assert_type(html("<p>Text</p>", unsafe_allow_javascript=True), DeltaGenerator)
    assert_type(html("<p>Text</p>", unsafe_allow_javascript=False), DeltaGenerator)

    # html with all parameters combined
    assert_type(
        html(
            "<p>Important notice</p>",
            width=400,
            unsafe_allow_javascript=True,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch", "content", or int)
    html("<p>Text</p>", width="invalid")  # type: ignore[arg-type]

    # width is keyword-only (cannot be passed positionally)
    html("<p>Text</p>", "stretch")  # type: ignore[misc]
