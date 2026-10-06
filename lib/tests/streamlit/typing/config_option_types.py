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

"""Type tests for st.get_option."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any

from typing_extensions import assert_type

if TYPE_CHECKING:
    from streamlit.config import get_option

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
