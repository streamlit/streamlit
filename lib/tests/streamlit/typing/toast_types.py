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
    from streamlit.elements.toast import ToastMixin

    toast = ToastMixin().toast

    # =====================================================================
    # st.toast return type tests
    # =====================================================================

    # Basic toast - returns DeltaGenerator
    assert_type(toast("Your changes have been saved!"), DeltaGenerator)

    # Toast with non-string body (SupportsStr protocol) - tests the body type contract
    assert_type(toast(42), DeltaGenerator)
    assert_type(toast(3.14), DeltaGenerator)

    # Toast with icon parameter (keyword-only)
    assert_type(toast("Success!", icon="✅"), DeltaGenerator)
    assert_type(toast("Loading...", icon=":material/check_circle:"), DeltaGenerator)
    assert_type(toast("Processing...", icon="spinner"), DeltaGenerator)
    assert_type(toast("Plain message", icon=None), DeltaGenerator)

    # Toast with duration parameter (keyword-only) - literal values
    assert_type(toast("Quick message", duration="short"), DeltaGenerator)
    assert_type(toast("Longer message", duration="long"), DeltaGenerator)
    assert_type(toast("Stay until dismissed", duration="infinite"), DeltaGenerator)

    # Toast with duration parameter (keyword-only) - integer value
    assert_type(toast("Custom duration", duration=5), DeltaGenerator)
    assert_type(toast("Another custom", duration=15), DeltaGenerator)

    # Toast with all parameters combined
    assert_type(
        toast(
            "Operation completed successfully!",
            icon="🎉",
            duration="long",
        ),
        DeltaGenerator,
    )

    assert_type(
        toast(
            "Processing your request...",
            icon="spinner",
            duration=10,
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid duration value (not "short", "long", "infinite", or int)
    toast("Message", duration="invalid")  # type: ignore[arg-type]

    # Invalid icon type (not str or None)
    toast("Message", icon=123)  # type: ignore[arg-type]

    # Passing icon as positional argument (should be keyword-only)
    toast("Message", "icon")  # type: ignore[misc]
