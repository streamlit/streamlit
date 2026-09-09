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

from typing import TYPE_CHECKING, Literal

from typing_extensions import assert_type

# Perform type checking tests for st.context. These are checked by mypy and ty,
# never executed at runtime.
if TYPE_CHECKING:
    # NOTE: st.context is a module-level attribute, not a Mixin method, so we
    # must import streamlit as st here rather than importing from a Mixin class.
    import streamlit as st
    from streamlit.runtime.context import (
        ContextProxy,
        StreamlitCookies,
        StreamlitHeaders,
        StreamlitTheme,
    )

    assert_type(st.context, ContextProxy)

    # =====================================================================
    # ContextProxy properties
    # =====================================================================

    assert_type(st.context.headers, StreamlitHeaders)
    assert_type(st.context["headers"], StreamlitHeaders)
    assert_type(st.context.cookies, StreamlitCookies)
    assert_type(st.context["cookies"], StreamlitCookies)
    assert_type(st.context.theme, StreamlitTheme)
    assert_type(st.context["theme"], StreamlitTheme)
    assert_type(st.context.timezone, str | None)
    assert_type(st.context["timezone"], str | None)
    assert_type(st.context.timezone_offset, int | None)
    assert_type(st.context["timezone_offset"], int | None)
    assert_type(st.context.locale, str | None)
    assert_type(st.context["locale"], str | None)
    assert_type(st.context.url, str | None)
    assert_type(st.context["url"], str | None)
    assert_type(st.context.ip_address, str | None)
    assert_type(st.context["ip_address"], str | None)
    assert_type(st.context.is_embedded, bool | None)
    assert_type(st.context["is_embedded"], bool | None)

    def _dynamic_context_key() -> str:
        return "timezone"

    assert_type(
        st.context[_dynamic_context_key()],
        StreamlitHeaders | StreamlitCookies | StreamlitTheme | str | int | bool | None,
    )

    # =====================================================================
    # StreamlitTheme: attribute and bracket access
    # =====================================================================

    assert_type(st.context.theme.type, Literal["dark", "light"] | None)
    assert_type(st.context.theme["type"], Literal["dark", "light"] | None)

    theme = StreamlitTheme({"type": "dark"})
    assert_type(theme.type, Literal["dark", "light"] | None)
    assert_type(theme["type"], Literal["dark", "light"] | None)

    # =====================================================================
    # StreamlitHeaders / StreamlitCookies: Mapping access
    # =====================================================================

    assert_type(st.context.headers["host"], str)
    assert_type(st.context.headers.get_all("pragma"), list[str])
    assert_type(st.context.headers.to_dict(), dict[str, str])

    assert_type(st.context.cookies["_ga"], str)
    assert_type(st.context.cookies.to_dict(), dict[str, str])
