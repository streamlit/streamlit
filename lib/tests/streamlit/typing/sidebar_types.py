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

    assert_type(st.sidebar.markdown("Hello"), DeltaGenerator)
    assert_type(st.sidebar.markdown("Hello", help="Help text"), DeltaGenerator)
    assert_type(st.sidebar.markdown("Hello", help=None), DeltaGenerator)
    assert_type(st.sidebar.markdown("Hello", width="stretch"), DeltaGenerator)
    assert_type(st.sidebar.markdown("Hello", width="content"), DeltaGenerator)
    assert_type(st.sidebar.markdown("Hello", width=300), DeltaGenerator)
    assert_type(st.sidebar.markdown("Hello", width="auto"), DeltaGenerator)
    assert_type(st.sidebar.text("Plain"), DeltaGenerator)
    assert_type(st.sidebar.title("Title"), DeltaGenerator)
    assert_type(st.sidebar.info("Note"), DeltaGenerator)
    assert_type(st.sidebar.metric("Users", 10, delta=1), DeltaGenerator)
    assert_type(st.sidebar.metric("Users", 10, delta=None), DeltaGenerator)
    assert_type(st.sidebar.write("Hello", 1, unsafe_allow_html=False), None)

    def _on_click(x: int, y: str) -> None:
        pass

    assert_type(st.sidebar.button("Click"), bool)
    assert_type(st.sidebar.button("Click", key="save"), bool)
    assert_type(st.sidebar.button("Click", key=123), bool)
    assert_type(st.sidebar.button("Click", key=None), bool)
    assert_type(st.sidebar.button("Click", help="Help text"), bool)
    assert_type(st.sidebar.button("Click", help=None), bool)
    assert_type(st.sidebar.button("Click", disabled=True), bool)
    assert_type(st.sidebar.button("Click", type="primary"), bool)
    assert_type(st.sidebar.button("Click", type="secondary"), bool)
    assert_type(st.sidebar.button("Click", type="tertiary"), bool)
    assert_type(st.sidebar.button("Click", width="content"), bool)
    assert_type(st.sidebar.button("Click", width="stretch"), bool)
    assert_type(st.sidebar.button("Click", width=200), bool)
    assert_type(
        st.sidebar.button("Click", on_click=None, args=None, kwargs=None),
        bool,
    )
    assert_type(
        st.sidebar.button("Click", on_click=_on_click, args=(1, "a")),
        bool,
    )
    assert_type(
        st.sidebar.button("Click", on_click=_on_click, kwargs={"x": 1, "y": "a"}),
        bool,
    )
    assert_type(
        st.sidebar.button(
            "Save",
            key="save_button",
            help="Save the form",
            on_click=_on_click,
            args=(1, "a"),
            kwargs=None,
            type="primary",
            icon=":material/save:",
            icon_position="right",
            disabled=False,
            width="stretch",
            shortcut="Ctrl+S",
            wrap=False,
        ),
        bool,
    )

    assert_type(st.sidebar.checkbox("Accept"), bool)
    assert_type(st.sidebar.checkbox("Accept", value=True), bool)
    assert_type(st.sidebar.checkbox("Accept", label_visibility="visible"), bool)
    assert_type(st.sidebar.checkbox("Accept", label_visibility="hidden"), bool)
    assert_type(st.sidebar.checkbox("Accept", label_visibility="collapsed"), bool)
    assert_type(st.sidebar.checkbox("Accept", on_change="rerun"), bool)
    assert_type(st.sidebar.checkbox("Accept", on_change="ignore"), bool)
    assert_type(st.sidebar.checkbox("Accept", on_change=None), bool)

    assert_type(st.sidebar.text_input("Name"), str)
    assert_type(st.sidebar.text_input("Name", value="Ada"), str)
    assert_type(st.sidebar.text_input("Name", value=None), str | None)
    assert_type(st.sidebar.selectbox("Pick", ["a", "b"]), str)
    assert_type(st.sidebar.selectbox("Pick", [1, 2]), int)
    assert_type(st.sidebar.slider("Value"), int)

    assert_type(st.sidebar.container(), DeltaGenerator)
    assert_type(st.sidebar.columns(2), list[DeltaGenerator])
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
