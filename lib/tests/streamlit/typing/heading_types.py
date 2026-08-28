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
    from streamlit.elements.heading import HeadingMixin

    title = HeadingMixin().title
    header = HeadingMixin().header
    subheader = HeadingMixin().subheader

    # =====================================================================
    # st.title return type tests
    # =====================================================================

    # Basic title - returns DeltaGenerator
    assert_type(title("My Title"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(title(42), DeltaGenerator)

    # Title with anchor parameter (positional-or-keyword)
    assert_type(title("Title", "my-anchor"), DeltaGenerator)
    assert_type(title("Title", anchor="custom-anchor"), DeltaGenerator)
    assert_type(title("Title", anchor=False), DeltaGenerator)
    assert_type(title("Title", anchor=None), DeltaGenerator)

    # Title with help parameter (keyword-only)
    assert_type(title("Title", help="Help text"), DeltaGenerator)
    assert_type(title("Title", help=None), DeltaGenerator)

    # Title with width parameter (keyword-only)
    assert_type(title("Title", width="stretch"), DeltaGenerator)
    assert_type(title("Title", width="content"), DeltaGenerator)
    assert_type(title("Title", width=300), DeltaGenerator)

    # Title with text_alignment parameter (keyword-only)
    assert_type(title("Title", text_alignment="left"), DeltaGenerator)
    assert_type(title("Title", text_alignment="center"), DeltaGenerator)
    assert_type(title("Title", text_alignment="right"), DeltaGenerator)
    assert_type(title("Title", text_alignment="justify"), DeltaGenerator)

    # Title with icon parameter (keyword-only)
    assert_type(title("Title", icon="🔥"), DeltaGenerator)
    assert_type(title("Title", icon=":material/dashboard:"), DeltaGenerator)
    assert_type(title("Title", icon="spinner"), DeltaGenerator)
    assert_type(title("Title", icon=None), DeltaGenerator)

    # Title with all parameters combined
    assert_type(
        title(
            "My Title",
            anchor="title-anchor",
            help="Title help text",
            width="stretch",
            text_alignment="center",
            icon=":material/dashboard:",
            wrap=True,
        ),
        DeltaGenerator,
    )

    # Title with wrap parameter (keyword-only)
    assert_type(title("Title", wrap=True), DeltaGenerator)
    assert_type(title("Title", wrap=False), DeltaGenerator)

    # =====================================================================
    # st.header return type tests
    # =====================================================================

    # Basic header - returns DeltaGenerator
    assert_type(header("My Header"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(header(42), DeltaGenerator)

    # Header with anchor parameter (positional-or-keyword)
    assert_type(header("Header", "my-anchor"), DeltaGenerator)
    assert_type(header("Header", anchor="custom-anchor"), DeltaGenerator)
    assert_type(header("Header", anchor=False), DeltaGenerator)
    assert_type(header("Header", anchor=None), DeltaGenerator)

    # Header with help parameter (keyword-only)
    assert_type(header("Header", help="Help text"), DeltaGenerator)
    assert_type(header("Header", help=None), DeltaGenerator)

    # Header with divider parameter (keyword-only)
    assert_type(header("Header", divider=True), DeltaGenerator)
    assert_type(header("Header", divider=False), DeltaGenerator)
    assert_type(header("Header", divider="blue"), DeltaGenerator)
    assert_type(header("Header", divider="green"), DeltaGenerator)
    assert_type(header("Header", divider="orange"), DeltaGenerator)
    assert_type(header("Header", divider="red"), DeltaGenerator)
    assert_type(header("Header", divider="violet"), DeltaGenerator)
    assert_type(header("Header", divider="yellow"), DeltaGenerator)
    assert_type(header("Header", divider="gray"), DeltaGenerator)
    assert_type(header("Header", divider="grey"), DeltaGenerator)
    assert_type(header("Header", divider="rainbow"), DeltaGenerator)
    assert_type(header("Header", divider=None), DeltaGenerator)

    # Header with width parameter (keyword-only)
    assert_type(header("Header", width="stretch"), DeltaGenerator)
    assert_type(header("Header", width="content"), DeltaGenerator)
    assert_type(header("Header", width=300), DeltaGenerator)

    # Header with text_alignment parameter (keyword-only)
    assert_type(header("Header", text_alignment="left"), DeltaGenerator)
    assert_type(header("Header", text_alignment="center"), DeltaGenerator)
    assert_type(header("Header", text_alignment="right"), DeltaGenerator)
    assert_type(header("Header", text_alignment="justify"), DeltaGenerator)

    # Header with icon parameter (keyword-only)
    assert_type(header("Header", icon="🔥"), DeltaGenerator)
    assert_type(header("Header", icon=":material/home:"), DeltaGenerator)
    assert_type(header("Header", icon="spinner"), DeltaGenerator)
    assert_type(header("Header", icon=None), DeltaGenerator)

    # Header with all parameters combined
    assert_type(
        header(
            "My Header",
            anchor="header-anchor",
            help="Header help text",
            divider="blue",
            width="stretch",
            text_alignment="left",
            icon=":material/home:",
            wrap=True,
        ),
        DeltaGenerator,
    )

    # Header with wrap parameter (keyword-only)
    assert_type(header("Header", wrap=True), DeltaGenerator)
    assert_type(header("Header", wrap=False), DeltaGenerator)

    # =====================================================================
    # st.subheader return type tests
    # =====================================================================

    # Basic subheader - returns DeltaGenerator
    assert_type(subheader("My Subheader"), DeltaGenerator)

    # body is SupportsStr, so non-str values should work
    assert_type(subheader(42), DeltaGenerator)

    # Subheader with anchor parameter (positional-or-keyword)
    assert_type(subheader("Subheader", "my-anchor"), DeltaGenerator)
    assert_type(subheader("Subheader", anchor="custom-anchor"), DeltaGenerator)
    assert_type(subheader("Subheader", anchor=False), DeltaGenerator)
    assert_type(subheader("Subheader", anchor=None), DeltaGenerator)

    # Subheader with help parameter (keyword-only)
    assert_type(subheader("Subheader", help="Help text"), DeltaGenerator)
    assert_type(subheader("Subheader", help=None), DeltaGenerator)

    # Subheader with divider parameter (keyword-only)
    assert_type(subheader("Subheader", divider=True), DeltaGenerator)
    assert_type(subheader("Subheader", divider=False), DeltaGenerator)
    assert_type(subheader("Subheader", divider="blue"), DeltaGenerator)
    assert_type(subheader("Subheader", divider="rainbow"), DeltaGenerator)
    assert_type(subheader("Subheader", divider=None), DeltaGenerator)

    # Subheader with width parameter (keyword-only)
    assert_type(subheader("Subheader", width="stretch"), DeltaGenerator)
    assert_type(subheader("Subheader", width="content"), DeltaGenerator)
    assert_type(subheader("Subheader", width=300), DeltaGenerator)

    # Subheader with text_alignment parameter (keyword-only)
    assert_type(subheader("Subheader", text_alignment="left"), DeltaGenerator)
    assert_type(subheader("Subheader", text_alignment="center"), DeltaGenerator)
    assert_type(subheader("Subheader", text_alignment="right"), DeltaGenerator)
    assert_type(subheader("Subheader", text_alignment="justify"), DeltaGenerator)

    # Subheader with icon parameter (keyword-only)
    assert_type(subheader("Subheader", icon="🔥"), DeltaGenerator)
    assert_type(subheader("Subheader", icon=":material/bolt:"), DeltaGenerator)
    assert_type(subheader("Subheader", icon="spinner"), DeltaGenerator)
    assert_type(subheader("Subheader", icon=None), DeltaGenerator)

    # Subheader with all parameters combined
    assert_type(
        subheader(
            "My Subheader",
            anchor="subheader-anchor",
            help="Subheader help text",
            divider="green",
            width="content",
            text_alignment="center",
            icon=":material/bolt:",
            wrap=False,
        ),
        DeltaGenerator,
    )

    # Subheader with wrap parameter (keyword-only)
    assert_type(subheader("Subheader", wrap=True), DeltaGenerator)
    assert_type(subheader("Subheader", wrap=False), DeltaGenerator)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # Invalid width value (not "stretch", "content", or int)
    title("Title", width="invalid")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    header("Header", width="auto")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    subheader("Subheader", width="auto")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Invalid text_alignment value (not "left", "center", "right", or "justify")
    title("Title", text_alignment="start")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    header("Header", text_alignment="end")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    subheader("Subheader", text_alignment="end")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing keyword-only parameters as positional (help is keyword-only)
    title("Title", "anchor", "help text")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    header("Header", "anchor", "help text")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]
    subheader("Subheader", "anchor", "help text")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Invalid wrap value (must be bool)
    title("Title", wrap="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    header("Header", wrap="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    subheader("Subheader", wrap="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
