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

"""Type tests for st.login."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

if TYPE_CHECKING:
    from streamlit.user_info import login

    # =====================================================================
    # st.login return type tests
    # =====================================================================

    # Returns None. Omitting provider selects the unnamed [auth] provider.
    assert_type(login(), None)
    assert_type(login(None), None)
    assert_type(login(provider=None), None)

    # A named provider is a string, positional or keyword.
    assert_type(login("google"), None)
    assert_type(login(provider="microsoft"), None)

    # A non-literal provider is still accepted.
    provider: str = "okta"
    assert_type(login(provider), None)
    assert_type(login(provider=provider), None)

    optional_provider: str | None = "auth0"
    assert_type(login(optional_provider), None)
    assert_type(login(provider=optional_provider), None)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # provider must be str or None
    login(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    login(["google"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    login(provider=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Only one positional argument
    login("google", "okta")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Unknown argument
    login("google", help="Log in")  # type: ignore[call-arg]  # ty: ignore[unknown-argument]
