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

"""Type tests for st.sidebar."""

from __future__ import annotations

from typing import TYPE_CHECKING, assert_type

# mypy and ty check this block. It is not executed at runtime.
if TYPE_CHECKING:
    # st.sidebar is a module attribute. Import the streamlit module to type it.
    import streamlit as st
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.mutable_expander_container import ExpanderContainer

    assert_type(st.sidebar, DeltaGenerator)

    # __enter__ returns None, so the `as` target is None.
    with st.sidebar as sidebar_ctx:
        assert_type(sidebar_ctx, None)

    # Parameter combinations for individual commands live in their own typing
    # tests. These calls only check that the sidebar keeps those return types.
    assert_type(st.sidebar.markdown("Hello"), DeltaGenerator)
    assert_type(st.sidebar.write("Hello", 1, unsafe_allow_html=False), None)
    assert_type(st.sidebar.button("Click"), bool)
    assert_type(st.sidebar.checkbox("Accept"), bool)
    assert_type(st.sidebar.text_input("Name"), str)
    assert_type(st.sidebar.text_input("Name", value=None), str | None)
    assert_type(st.sidebar.selectbox("Pick", ["a", "b"]), str)
    assert_type(st.sidebar.selectbox("Pick", [1, 2]), int)
    assert_type(st.sidebar.slider("Value"), int)

    assert_type(st.sidebar.container(), DeltaGenerator)
    assert_type(st.sidebar.columns(2), tuple[DeltaGenerator, DeltaGenerator])
    assert_type(st.sidebar.columns([0.7, 0.3]), list[DeltaGenerator])

    assert_type(st.sidebar.form("filters"), DeltaGenerator)
    # form() returns a DeltaGenerator, so __enter__ returns None.
    with st.sidebar.form("filters") as form:
        assert_type(form, None)

    assert_type(st.sidebar.expander("Details"), ExpanderContainer)
    # ExpanderContainer.__enter__ returns the expander.
    with st.sidebar.expander("Details") as expander:
        assert_type(expander, ExpanderContainer)
        assert_type(expander.markdown("Inside"), DeltaGenerator)

    # Module-level commands and unknown names stay type errors on the sidebar.
    st.sidebar.echo()  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
    st.sidebar.logo("logo.png")  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
    st.sidebar.login()  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
    st.sidebar.logout()  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
    st.sidebar.dialog("Settings")  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
    st.sidebar.not_a_streamlit_command()  # type: ignore[attr-defined]  # ty: ignore[unresolved-attribute]
