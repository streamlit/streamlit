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

"""Type tests for st.chat_message."""

from __future__ import annotations

from typing import TYPE_CHECKING

from typing_extensions import assert_type

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    import io
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.widgets.chat import ChatMixin

    chat_message = ChatMixin().chat_message

    # =====================================================================
    # st.chat_message return type tests
    # =====================================================================

    # Basic usage - returns DeltaGenerator
    assert_type(chat_message("user"), DeltaGenerator)
    assert_type(chat_message("assistant"), DeltaGenerator)
    assert_type(chat_message("ai"), DeltaGenerator)
    assert_type(chat_message("human"), DeltaGenerator)

    # Arbitrary author name (str is accepted beyond the preset literals)
    assert_type(chat_message("Alice"), DeltaGenerator)

    # Returned container can be written to directly
    message = chat_message("assistant")
    assert_type(message.write("Hello"), None)

    # avatar: preset literals, emoji, material icon, None
    assert_type(chat_message("user", avatar="user"), DeltaGenerator)
    assert_type(chat_message("assistant", avatar="assistant"), DeltaGenerator)
    assert_type(chat_message("user", avatar="🧑‍💻"), DeltaGenerator)
    assert_type(chat_message("user", avatar=":material/thumb_up:"), DeltaGenerator)
    assert_type(chat_message("user", avatar=None), DeltaGenerator)

    # avatar: image types supported by st.image (except list)
    assert_type(chat_message("user", avatar="path/to/avatar.png"), DeltaGenerator)
    assert_type(chat_message("user", avatar=Path("path/to/avatar.png")), DeltaGenerator)
    assert_type(chat_message("user", avatar=b"binary image"), DeltaGenerator)
    assert_type(
        chat_message("user", avatar=io.BytesIO(b"binary image")), DeltaGenerator
    )

    # width: "stretch", "content", or int
    assert_type(chat_message("user", width="stretch"), DeltaGenerator)
    assert_type(chat_message("user", width="content"), DeltaGenerator)
    assert_type(chat_message("user", width=300), DeltaGenerator)

    # All parameters combined
    assert_type(
        chat_message(
            "assistant",
            avatar=":material/smart_toy:",
            width="stretch",
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # Invalid usages - should NOT type check
    # =====================================================================

    # name is required
    chat_message()  # type: ignore[call-arg]  # ty: ignore[missing-argument]

    # name must be a str
    chat_message(123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    chat_message(None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # avatar does not accept a list (unlike st.image)
    chat_message("user", avatar=["a.png", "b.png"])  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # avatar does not accept an int
    chat_message("user", avatar=123)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]

    # Passing keyword-only parameters as positional
    chat_message("user", "🧑‍💻")  # type: ignore[call-arg]  # ty: ignore[too-many-positional-arguments]

    # Invalid width value (not "stretch", "content", or int)
    chat_message("user", width="auto")  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
    chat_message("user", width=None)  # type: ignore[arg-type]  # ty: ignore[invalid-argument-type]
