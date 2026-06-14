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
    from streamlit.elements.spinner import SpinnerMixin, SpinnerPlaceholder

    spinner = SpinnerMixin().spinner

    # =====================================================================
    # st.spinner return type tests
    # =====================================================================

    # Basic spinner - returns SpinnerPlaceholder
    assert_type(spinner(), SpinnerPlaceholder)
    assert_type(spinner("Loading..."), SpinnerPlaceholder)

    # Spinner with show_time parameter
    assert_type(spinner("Loading...", show_time=True), SpinnerPlaceholder)
    assert_type(spinner("Loading...", show_time=False), SpinnerPlaceholder)

    # Spinner with width parameter - "content", "stretch", or int
    assert_type(spinner("Loading...", width="content"), SpinnerPlaceholder)
    assert_type(spinner("Loading...", width="stretch"), SpinnerPlaceholder)
    assert_type(spinner("Loading...", width=300), SpinnerPlaceholder)

    # Spinner with all parameters combined
    assert_type(
        spinner("Loading...", show_time=True, width="stretch"),
        SpinnerPlaceholder,
    )

    # SpinnerPlaceholder supports the context-manager protocol.
    with spinner("Loading...") as placeholder:
        assert_type(placeholder, SpinnerPlaceholder)
