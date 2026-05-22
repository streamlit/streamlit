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
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.progress import ProgressMixin

    progress = ProgressMixin().progress

    # =====================================================================
    # st.progress return type tests
    # =====================================================================

    # Basic progress with int value (0-100) - returns DeltaGenerator
    assert_type(progress(0), DeltaGenerator)
    assert_type(progress(50), DeltaGenerator)
    assert_type(progress(100), DeltaGenerator)

    # Basic progress with float value (0.0-1.0)
    assert_type(progress(0.0), DeltaGenerator)
    assert_type(progress(0.5), DeltaGenerator)
    assert_type(progress(1.0), DeltaGenerator)

    # Progress with text parameter
    assert_type(progress(50, text="Loading..."), DeltaGenerator)
    assert_type(progress(0.5, text="Processing data"), DeltaGenerator)
    assert_type(progress(75, text=None), DeltaGenerator)

    # Progress with width parameter - "stretch" literal
    assert_type(progress(50, width="stretch"), DeltaGenerator)

    # Progress with width parameter - int (pixels)
    assert_type(progress(50, width=200), DeltaGenerator)
    assert_type(progress(50, width=400), DeltaGenerator)

    # Progress with text and width combined
    assert_type(progress(50, text="Loading...", width="stretch"), DeltaGenerator)
    assert_type(progress(0.75, text="Almost done", width=300), DeltaGenerator)

    # Progress with all parameters combined
    assert_type(
        progress(
            50,
            text="Operation in progress",
            width="stretch",
        ),
        DeltaGenerator,
    )

    assert_type(
        progress(
            0.8,
            text="80% complete",
            width=250,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid value type (not int or float)
    progress("invalid_string")  # type: ignore[arg-type]

    # Invalid text type (not str or None)
    progress(50, text=123)  # type: ignore[arg-type]

    # Invalid width value (not "stretch" or int)
    progress(50, width="full")  # type: ignore[arg-type]
