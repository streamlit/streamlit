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
    from matplotlib.figure import Figure

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.pyplot import PyplotMixin

    pyplot = PyplotMixin().pyplot
    fig = Figure()

    # =====================================================================
    # st.pyplot return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(pyplot(), DeltaGenerator)
    assert_type(pyplot(fig), DeltaGenerator)
    assert_type(pyplot(None), DeltaGenerator)

    # pyplot with clear_figure parameter
    assert_type(pyplot(fig, clear_figure=True), DeltaGenerator)
    assert_type(pyplot(fig, clear_figure=False), DeltaGenerator)
    assert_type(pyplot(fig, clear_figure=None), DeltaGenerator)

    # pyplot with width parameter
    assert_type(pyplot(fig, width="stretch"), DeltaGenerator)
    assert_type(pyplot(fig, width="content"), DeltaGenerator)
    assert_type(pyplot(fig, width=400), DeltaGenerator)

    # pyplot with use_container_width parameter (deprecated)
    assert_type(pyplot(fig, use_container_width=True), DeltaGenerator)
    assert_type(pyplot(fig, use_container_width=False), DeltaGenerator)
    assert_type(pyplot(fig, use_container_width=None), DeltaGenerator)

    # pyplot with extra savefig kwargs (**kwargs: Any)
    assert_type(pyplot(fig, dpi=300, transparent=True), DeltaGenerator)

    # pyplot with all parameters combined
    assert_type(
        pyplot(
            fig,
            clear_figure=True,
            width="stretch",
            use_container_width=None,
            dpi=200,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "content", "stretch", or int)
    pyplot(fig, width="invalid")  # type: ignore[arg-type]

    # Invalid clear_figure value (not bool or None)
    pyplot(fig, clear_figure="yes")  # type: ignore[arg-type]

    # Passing width as positional argument (should be keyword-only)
    pyplot(fig, None, "stretch")  # type: ignore[misc]
