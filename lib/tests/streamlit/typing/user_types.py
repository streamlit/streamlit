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

# Perform type checking tests for st.user. These are checked by mypy and ty,
# never executed at runtime.
if TYPE_CHECKING:
    # NOTE: st.user is a module-level attribute, not a Mixin method, so we must
    # import streamlit as st here rather than importing from a Mixin class.
    import streamlit as st
    from streamlit.user_info import TokensProxy, UserInfoProxy

    assert_type(st.user, UserInfoProxy)

    # =====================================================================
    # is_logged_in and tokens: attribute and bracket access
    # =====================================================================

    assert_type(st.user.is_logged_in, bool)
    assert_type(st.user["is_logged_in"], bool)

    assert_type(st.user.tokens, TokensProxy)
    assert_type(st.user["tokens"], TokensProxy)

    # =====================================================================
    # TokensProxy: documented token names, attribute and bracket access
    # =====================================================================

    assert_type(st.user.tokens.id, str)
    assert_type(st.user.tokens["id"], str)
    assert_type(st.user.tokens.access, str)
    assert_type(st.user.tokens["access"], str)
    assert_type(st.user["tokens"].id, str)
    assert_type(st.user["tokens"]["id"], str)
    assert_type(st.user["tokens"].access, str)
    assert_type(st.user["tokens"]["access"], str)

    # Other token names stay str.
    assert_type(st.user.tokens["refresh"], str)

    # =====================================================================
    # Provider-specific OIDC claims stay on the open Mapping types
    # =====================================================================

    assert_type(st.user.email, str | bool | TokensProxy | None)
    assert_type(st.user["email"], str | bool | TokensProxy | None)
    assert_type(st.user.name, str | bool | TokensProxy | None)
    assert_type(st.user["name"], str | bool | TokensProxy | None)
