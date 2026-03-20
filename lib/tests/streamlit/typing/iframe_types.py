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
    from streamlit.elements.iframe import IframeMixin

    iframe = IframeMixin().iframe

    # st.iframe returns DeltaGenerator
    assert_type(iframe("<p>Hello</p>"), DeltaGenerator)

    # URL source
    assert_type(iframe("https://example.com", height=600), DeltaGenerator)

    # Data URL
    assert_type(iframe("data:text/html,<h1>Hi</h1>", height=100), DeltaGenerator)

    # Relative URL
    assert_type(iframe("/app/static/report.html", height=400), DeltaGenerator)

    # Path object
    assert_type(iframe(Path("reports/analysis.html"), height=800), DeltaGenerator)

    # Width parameter - int, "stretch", "content"
    assert_type(iframe("<p>Test</p>", width=300, height=100), DeltaGenerator)
    assert_type(iframe("<p>Test</p>", width="stretch", height=100), DeltaGenerator)
    assert_type(iframe("<p>Test</p>", width="content", height=100), DeltaGenerator)

    # Height parameter - int, "stretch", "content"
    assert_type(iframe("<p>Test</p>", height=200), DeltaGenerator)
    assert_type(iframe("<p>Test</p>", height="stretch"), DeltaGenerator)
    assert_type(iframe("<p>Test</p>", height="content"), DeltaGenerator)

    # Default height (content)
    assert_type(iframe("<p>Test</p>"), DeltaGenerator)

    # tab_index parameter
    assert_type(iframe("<p>Test</p>", height=100, tab_index=0), DeltaGenerator)
    assert_type(iframe("<p>Test</p>", height=100, tab_index=-1), DeltaGenerator)
    assert_type(iframe("<p>Test</p>", height=100, tab_index=None), DeltaGenerator)

    # All parameters combined
    assert_type(
        iframe(
            "<p>Full test</p>",
            width="stretch",
            height=500,
            tab_index=0,
        ),
        DeltaGenerator,
    )
