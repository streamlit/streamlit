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
    from streamlit.elements.alert import AlertMixin

    error = AlertMixin().error
    warning = AlertMixin().warning
    info = AlertMixin().info
    success = AlertMixin().success

    # =====================================================================
    # st.error return type tests
    # =====================================================================

    # Basic error - returns DeltaGenerator
    assert_type(error("An error occurred!"), DeltaGenerator)

    # Error with icon parameter (keyword-only)
    assert_type(error("Error!", icon="🚨"), DeltaGenerator)
    assert_type(error("Error!", icon=":material/error:"), DeltaGenerator)
    assert_type(error("Error!", icon=None), DeltaGenerator)

    # Error with width parameter (keyword-only)
    assert_type(error("Error!", width="stretch"), DeltaGenerator)
    assert_type(error("Error!", width=400), DeltaGenerator)

    # Error with title parameter (keyword-only)
    assert_type(error("Details here", title="Error Title"), DeltaGenerator)
    assert_type(error("Details here", title=None), DeltaGenerator)

    # Error with all parameters combined
    assert_type(
        error(
            "Something went wrong. Please try again.",
            icon="🚨",
            width="stretch",
            title="Error",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.warning return type tests
    # =====================================================================

    # Basic warning - returns DeltaGenerator
    assert_type(warning("This is a warning!"), DeltaGenerator)

    # Warning with icon parameter (keyword-only)
    assert_type(warning("Warning!", icon="⚠️"), DeltaGenerator)
    assert_type(warning("Warning!", icon=":material/warning:"), DeltaGenerator)
    assert_type(warning("Warning!", icon=None), DeltaGenerator)

    # Warning with width parameter (keyword-only)
    assert_type(warning("Warning!", width="stretch"), DeltaGenerator)
    assert_type(warning("Warning!", width=400), DeltaGenerator)

    # Warning with title parameter (keyword-only)
    assert_type(warning("Details here", title="Warning Title"), DeltaGenerator)
    assert_type(warning("Details here", title=None), DeltaGenerator)

    # Warning with all parameters combined
    assert_type(
        warning(
            "Please review before proceeding.",
            icon="⚠️",
            width="stretch",
            title="Caution",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.info return type tests
    # =====================================================================

    # Basic info - returns DeltaGenerator
    assert_type(info("This is an informational message."), DeltaGenerator)

    # Info with icon parameter (keyword-only)
    assert_type(info("Info!", icon="💡"), DeltaGenerator)
    assert_type(info("Info!", icon=":material/info:"), DeltaGenerator)
    assert_type(info("Info!", icon=None), DeltaGenerator)

    # Info with width parameter (keyword-only)
    assert_type(info("Info!", width="stretch"), DeltaGenerator)
    assert_type(info("Info!", width=400), DeltaGenerator)

    # Info with title parameter (keyword-only)
    assert_type(info("Details here", title="Information"), DeltaGenerator)
    assert_type(info("Details here", title=None), DeltaGenerator)

    # Info with all parameters combined
    assert_type(
        info(
            "This feature is currently in beta.",
            icon="💡",
            width="stretch",
            title="Note",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.success return type tests
    # =====================================================================

    # Basic success - returns DeltaGenerator
    assert_type(success("Operation completed successfully!"), DeltaGenerator)

    # Success with icon parameter (keyword-only)
    assert_type(success("Success!", icon="✅"), DeltaGenerator)
    assert_type(success("Success!", icon=":material/check_circle:"), DeltaGenerator)
    assert_type(success("Success!", icon=None), DeltaGenerator)

    # Success with width parameter (keyword-only)
    assert_type(success("Success!", width="stretch"), DeltaGenerator)
    assert_type(success("Success!", width=400), DeltaGenerator)

    # Success with title parameter (keyword-only)
    assert_type(success("Details here", title="Success!"), DeltaGenerator)
    assert_type(success("Details here", title=None), DeltaGenerator)

    # Success with all parameters combined
    assert_type(
        success(
            "Your changes have been saved.",
            icon="✅",
            width="stretch",
            title="Done",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch" or int)
    error("Error!", width="invalid")  # type: ignore[arg-type]

    # Invalid icon type (not str or None)
    error("Error!", icon=123)  # type: ignore[arg-type]

    # Passing icon as positional argument (should be keyword-only)
    error("Error!", "icon")  # type: ignore[misc]
