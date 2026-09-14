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

from typing import TYPE_CHECKING, Any

from typing_extensions import assert_type

if TYPE_CHECKING:
    from collections.abc import AsyncGenerator, Generator

    from streamlit.elements.write import WriteMixin

    write = WriteMixin().write
    write_stream = WriteMixin().write_stream

    # =====================================================================
    # st.write return type tests
    # =====================================================================

    # Basic usage - returns None
    assert_type(write("Hello, world!"), None)

    # Multiple positional arguments of any type
    assert_type(write("1 + 1 = ", 2), None)
    assert_type(write("a", "b", "c"), None)

    # Non-str values (write accepts *args: Any)
    assert_type(write(42), None)
    assert_type(write({"key": "value"}), None)
    assert_type(write([1, 2, 3]), None)

    # A no-argument call is valid and returns None
    assert_type(write(), None)

    # unsafe_allow_html parameter (keyword-only)
    assert_type(write("<p>HTML</p>", unsafe_allow_html=True), None)
    assert_type(write("Safe text", unsafe_allow_html=False), None)

    # All parameters combined
    assert_type(write("Text", 123, unsafe_allow_html=True), None)

    # =====================================================================
    # st.write_stream return type tests
    # =====================================================================

    def text_generator() -> Generator[str, None, None]:
        yield "Hello"

    async def async_text_generator() -> AsyncGenerator[str, None]:
        yield "Hello"

    # A generator function passed uncalled (matches Callable[..., Any])
    assert_type(write_stream(text_generator), list[Any] | str)

    # An already-created generator
    assert_type(write_stream(text_generator()), list[Any] | str)

    # An iterable
    assert_type(write_stream(["a", "b", "c"]), list[Any] | str)

    # An async generator instance
    assert_type(write_stream(async_text_generator()), list[Any] | str)

    # An async generator function passed uncalled (matches Callable[..., Any])
    assert_type(write_stream(async_text_generator), list[Any] | str)

    # cursor parameter (keyword-only)
    assert_type(write_stream(text_generator, cursor="▌"), list[Any] | str)
    assert_type(write_stream(text_generator, cursor=None), list[Any] | str)

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # unsafe_allow_html must be a bool
    write("Text", unsafe_allow_html="yes")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # cursor must be str or None
    write_stream(text_generator, cursor=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # cursor is keyword-only, cannot be passed positionally
    write_stream(text_generator, "▌")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # stream must be a Callable, Generator, Iterable, or AsyncGenerator
    write_stream(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
