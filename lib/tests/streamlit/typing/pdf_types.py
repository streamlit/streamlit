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
    import io
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.pdf import PdfMixin

    pdf = PdfMixin().pdf

    # =====================================================================
    # st.pdf return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator for each supported data type
    assert_type(pdf("https://example.com/sample.pdf"), DeltaGenerator)
    assert_type(pdf("path/to/file.pdf"), DeltaGenerator)
    assert_type(pdf(Path("path/to/file.pdf")), DeltaGenerator)
    assert_type(pdf(b"binary data"), DeltaGenerator)
    assert_type(pdf(io.BytesIO(b"binary data")), DeltaGenerator)

    # pdf with height parameter - int or "stretch"
    assert_type(pdf("file.pdf", height=600), DeltaGenerator)
    assert_type(pdf("file.pdf", height="stretch"), DeltaGenerator)

    # pdf with key parameter - str or None
    assert_type(pdf("file.pdf", key="my_pdf"), DeltaGenerator)
    assert_type(pdf("file.pdf", key=None), DeltaGenerator)

    # pdf with all parameters combined
    assert_type(
        pdf(
            "file.pdf",
            height="stretch",
            key="my_pdf",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid height value (not int or "stretch")
    pdf("file.pdf", height="content")  # type: ignore[arg-type]

    # height is keyword-only and cannot be passed positionally
    pdf("file.pdf", 600)  # type: ignore[misc]
