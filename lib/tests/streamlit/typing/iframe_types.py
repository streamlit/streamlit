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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.iframe import IframeMixin

    iframe = IframeMixin().iframe

    # Basic iframe usage
    assert_type(iframe("https://example.com"), DeltaGenerator)
    assert_type(iframe("<p>Hello</p>"), DeltaGenerator)
    assert_type(iframe(Path("report.html")), DeltaGenerator)

    # Width parameter
    assert_type(iframe("https://example.com", width="stretch"), DeltaGenerator)
    assert_type(iframe("https://example.com", width="content"), DeltaGenerator)
    assert_type(iframe("https://example.com", width=320), DeltaGenerator)

    # Height parameter
    assert_type(iframe("https://example.com", height="content"), DeltaGenerator)
    assert_type(iframe("https://example.com", height="stretch"), DeltaGenerator)
    assert_type(iframe("https://example.com", height=480), DeltaGenerator)

    # Tab index parameter
    assert_type(iframe("https://example.com", tab_index=None), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=-1), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=0), DeltaGenerator)
    assert_type(iframe("https://example.com", tab_index=3), DeltaGenerator)

    # Combined parameters
    assert_type(
        iframe(
            Path("dashboard.html"),
            width="stretch",
            height="content",
            tab_index=1,
        ),
        DeltaGenerator,
    )
