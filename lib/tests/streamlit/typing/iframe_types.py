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

# Perform type checking tests for st.iframe
# The return type is always DeltaGenerator
if TYPE_CHECKING:
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.iframe import IframeMixin

    iframe = IframeMixin().iframe

    # =====================================================================
    # Basic return type tests - always returns DeltaGenerator
    # =====================================================================

    # String URL
    assert_type(iframe("https://example.com"), DeltaGenerator)
    assert_type(iframe("http://example.com"), DeltaGenerator)
    assert_type(iframe("data:text/html,<h1>Hello</h1>"), DeltaGenerator)

    # Relative URL
    assert_type(iframe("/app/static/report.html"), DeltaGenerator)

    # HTML string
    assert_type(iframe("<h1>Hello World</h1>"), DeltaGenerator)

    # =====================================================================
    # Test with Path object
    # =====================================================================

    assert_type(iframe(Path("report.html")), DeltaGenerator)
    assert_type(iframe(Path("/path/to/file.pdf")), DeltaGenerator)

    # =====================================================================
    # Test width parameter
    # =====================================================================

    assert_type(iframe("https://example.com", width="stretch"), DeltaGenerator)
    assert_type(iframe("https://example.com", width="content"), DeltaGenerator)
    assert_type(iframe("https://example.com", width=800), DeltaGenerator)

    # =====================================================================
    # Test height parameter
    # =====================================================================

    assert_type(iframe("https://example.com", height="stretch"), DeltaGenerator)
    assert_type(iframe("https://example.com", height="content"), DeltaGenerator)
    assert_type(iframe("https://example.com", height=600), DeltaGenerator)

    # =====================================================================
    # Test tab_index parameter
    # =====================================================================

    assert_type(iframe("https://example.com", tab_index=None), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=-1), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=0), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=1), DeltaGenerator)

    # =====================================================================
    # Test combined parameters
    # =====================================================================

    assert_type(
        iframe(
            "https://docs.streamlit.io",
            width="stretch",
            height=600,
            tab_index=0,
        ),
        DeltaGenerator,
    )

    assert_type(
        iframe(
            Path("dashboard.html"),
            width=800,
            height="content",
            tab_index=None,
        ),
        DeltaGenerator,
    )

    assert_type(
        iframe(
            "<div>Custom HTML</div>",
            width="content",
            height="content",
            tab_index=-1,
        ),
        DeltaGenerator,
    )
