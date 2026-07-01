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

"""Type tests for st.form."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.form import FormMixin

    form = FormMixin().form

    # =====================================================================
    # st.form return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(form("my_form"), DeltaGenerator)

    # clear_on_submit as a positional argument
    assert_type(form("my_form", True), DeltaGenerator)

    # clear_on_submit as a keyword argument
    assert_type(form("my_form", clear_on_submit=True), DeltaGenerator)

    # enter_to_submit
    assert_type(form("my_form", enter_to_submit=False), DeltaGenerator)

    # border
    assert_type(form("my_form", border=False), DeltaGenerator)

    # width accepts "stretch", "content", or int
    assert_type(form("my_form", width="stretch"), DeltaGenerator)
    assert_type(form("my_form", width="content"), DeltaGenerator)
    assert_type(form("my_form", width=300), DeltaGenerator)

    # height accepts "content", "stretch", or int
    assert_type(form("my_form", height="content"), DeltaGenerator)
    assert_type(form("my_form", height="stretch"), DeltaGenerator)
    assert_type(form("my_form", height=200), DeltaGenerator)

    # All parameters combined
    assert_type(
        form(
            "my_form",
            clear_on_submit=True,
            enter_to_submit=False,
            border=False,
            width=400,
            height=500,
        ),
        DeltaGenerator,
    )
