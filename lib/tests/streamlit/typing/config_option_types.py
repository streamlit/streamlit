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

"""Type tests for st.get_option and st.set_option.

``st.set_option`` wraps ``streamlit.config.set_user_option``. Only the
internal ``streamlit.config.set_option`` accepts ``where_defined``.
"""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, assert_type

if TYPE_CHECKING:
    from streamlit.config import get_option
    from streamlit.config import set_user_option as set_option

    # =====================================================================
    # st.get_option return type tests
    # =====================================================================

    # Returns Any because each config option has its own value type.
    assert_type(get_option("theme.primaryColor"), Any)
    assert_type(get_option("server.port"), Any)
    assert_type(get_option("client.showErrorDetails"), Any)
    assert_type(get_option(key="theme.primaryColor"), Any)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Missing required key
    get_option()  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    # Non-str key
    get_option(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    get_option(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    get_option(["theme.primaryColor"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    get_option(key=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Too many positional arguments
    get_option("theme.primaryColor", True)  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Unknown argument
    get_option("theme.primaryColor", help="Get the color")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
    get_option("theme.primaryColor", width="stretch")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]

    # =====================================================================
    # st.set_option return type tests
    # =====================================================================

    # Returns None. value is Any because scriptable options use different
    # types: bool for most, and a string level or a legacy bool for
    # client.showErrorDetails.
    assert_type(set_option("client.showErrorDetails", True), None)
    assert_type(set_option("client.showErrorDetails", "full"), None)
    assert_type(set_option("client.toolbarMode", "auto"), None)
    assert_type(set_option("client.disableDataExport", False), None)
    assert_type(set_option("client.showSidebarNavigation", True), None)

    # A non-literal key is still accepted; unknown keys fail at runtime.
    option_key: str = "client.toolbarMode"
    assert_type(set_option(option_key, "viewer"), None)

    # value is Any, including None and a non-literal value.
    option_value: Any = True
    assert_type(set_option("client.showErrorDetails", option_value), None)
    assert_type(set_option("client.disableDataExport", None), None)

    # Both parameters as keywords
    assert_type(
        set_option(key="client.showErrorDetails", value="none"),
        None,
    )

    # =====================================================================
    # Invalid st.set_option usages - should NOT type check
    # =====================================================================

    # Missing required arguments
    set_option()  # type: ignore[call-arg]  # ty: ignore[missing-argument]
    set_option("client.showErrorDetails")  # type: ignore[call-arg]  # ty: ignore[missing-argument]
    set_option(value=True)  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    # Non-str key
    set_option(123, True)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    set_option(None, True)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    set_option(["client.showErrorDetails"], True)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    set_option(key=123, value=True)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Only internal config.set_option accepts a third positional argument
    # (where_defined). ty reports on that extra argument; mypy reports on
    # the whole call.
    set_option(
        "client.showErrorDetails",
        True,
        "<user defined>",  # ty: ignore[too-many-positional-arguments]
    )  # type: ignore[call-arg]

    # Unknown arguments
    set_option(
        "client.showErrorDetails",
        True,
        where_defined="<user defined>",  # ty: ignore[unknown-argument]
    )  # type: ignore[call-arg]
    set_option(
        "client.showErrorDetails",
        True,
        help="Set the option",  # ty: ignore[unknown-argument]
    )  # type: ignore[call-arg]
