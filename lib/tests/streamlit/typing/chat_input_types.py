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

# Perform type checking tests for st.chat_input
# The return type depends on accept_file and accept_audio parameters:
# - accept_file=False and accept_audio=False (default) -> returns str | None
# - accept_file=True/multiple/directory OR accept_audio=True -> returns ChatInputValue | None
if TYPE_CHECKING:
    from streamlit.elements.widgets.chat import ChatInputValue, ChatMixin

    chat_input = ChatMixin().chat_input

    # =====================================================================
    # Basic return type tests based on accept_file and accept_audio
    # =====================================================================

    # Default (no file/audio acceptance) returns str | None
    assert_type(chat_input(), str | None)
    assert_type(chat_input("Your message"), str | None)
    assert_type(chat_input(placeholder="Ask me anything"), str | None)

    # accept_file=False explicitly still returns str | None
    assert_type(chat_input("Message", accept_file=False), str | None)
    assert_type(
        chat_input("Message", accept_file=False, accept_audio=False), str | None
    )

    # accept_file=True returns ChatInputValue | None
    assert_type(chat_input("Message", accept_file=True), ChatInputValue | None)

    # accept_file="multiple" returns ChatInputValue | None
    assert_type(chat_input("Message", accept_file="multiple"), ChatInputValue | None)

    # accept_file="directory" returns ChatInputValue | None
    assert_type(chat_input("Message", accept_file="directory"), ChatInputValue | None)

    # accept_audio=True returns ChatInputValue | None
    assert_type(chat_input("Message", accept_audio=True), ChatInputValue | None)

    # Both accept_file and accept_audio enabled returns ChatInputValue | None
    assert_type(
        chat_input("Message", accept_file=True, accept_audio=True),
        ChatInputValue | None,
    )
    assert_type(
        chat_input("Message", accept_file="multiple", accept_audio=True),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test key parameter (str or int)
    # =====================================================================

    assert_type(chat_input("Message", key="chat_key"), str | None)
    assert_type(chat_input("Message", key=123), str | None)
    assert_type(chat_input("Message", key=None), str | None)
    assert_type(
        chat_input("Message", accept_file=True, key="chat_key"), ChatInputValue | None
    )

    # =====================================================================
    # Test max_chars parameter
    # =====================================================================

    assert_type(chat_input("Message", max_chars=500), str | None)
    assert_type(chat_input("Message", max_chars=None), str | None)
    assert_type(
        chat_input("Message", accept_file=True, max_chars=1000), ChatInputValue | None
    )

    # =====================================================================
    # Test max_upload_size parameter
    # =====================================================================

    assert_type(chat_input("Message", max_upload_size=10), str | None)
    assert_type(chat_input("Message", max_upload_size=None), str | None)
    assert_type(
        chat_input("Message", accept_file=True, max_upload_size=50),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test file_type parameter
    # =====================================================================

    assert_type(chat_input("Message", file_type="csv"), str | None)
    assert_type(chat_input("Message", file_type=["jpg", "png"]), str | None)
    assert_type(chat_input("Message", file_type=None), str | None)
    assert_type(
        chat_input("Message", accept_file=True, file_type="pdf"), ChatInputValue | None
    )
    assert_type(
        chat_input("Message", accept_file="multiple", file_type=["doc", "docx"]),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test audio_sample_rate parameter (only with accept_audio=True)
    # =====================================================================

    assert_type(
        chat_input("Message", accept_audio=True, audio_sample_rate=16000),
        ChatInputValue | None,
    )
    assert_type(
        chat_input("Message", accept_audio=True, audio_sample_rate=44100),
        ChatInputValue | None,
    )
    assert_type(
        chat_input("Message", accept_audio=True, audio_sample_rate=None),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test disabled parameter
    # =====================================================================

    assert_type(chat_input("Message", disabled=True), str | None)
    assert_type(chat_input("Message", disabled=False), str | None)
    assert_type(
        chat_input("Message", accept_file=True, disabled=True), ChatInputValue | None
    )

    # =====================================================================
    # Test width parameter
    # =====================================================================

    assert_type(chat_input("Message", width="stretch"), str | None)
    assert_type(chat_input("Message", width=400), str | None)
    assert_type(
        chat_input("Message", accept_file=True, width="stretch"), ChatInputValue | None
    )
    assert_type(
        chat_input("Message", accept_file=True, width=500), ChatInputValue | None
    )

    # =====================================================================
    # Test callback parameters (on_submit, args, kwargs)
    # =====================================================================

    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(chat_input("Message", on_submit=my_callback), str | None)
    assert_type(
        chat_input("Message", on_submit=callback_with_args, args=(1, "test")),
        str | None,
    )
    assert_type(
        chat_input("Message", on_submit=callback_with_args, kwargs={"x": 1, "y": "a"}),
        str | None,
    )
    assert_type(chat_input("Message", on_submit=None), str | None)
    assert_type(
        chat_input("Message", accept_file=True, on_submit=my_callback),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test with all parameters combined (no file/audio - returns str | None)
    # =====================================================================

    assert_type(
        chat_input(
            placeholder="Ask me anything",
            key="full_chat",
            max_chars=1000,
            max_upload_size=None,
            accept_file=False,
            file_type=None,
            accept_audio=False,
            disabled=False,
            on_submit=my_callback,
            args=None,
            kwargs=None,
            width="stretch",
        ),
        str | None,
    )

    # =====================================================================
    # Test with all parameters combined (accept_file=True - returns ChatInputValue | None)
    # =====================================================================

    assert_type(
        chat_input(
            placeholder="Upload files",
            key="file_chat",
            max_chars=500,
            max_upload_size=100,
            accept_file=True,
            file_type=["pdf", "doc"],
            accept_audio=False,
            audio_sample_rate=16000,
            disabled=False,
            on_submit=my_callback,
            args=None,
            kwargs=None,
            width=600,
        ),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test with all parameters combined (accept_audio=True - returns ChatInputValue | None)
    # =====================================================================

    assert_type(
        chat_input(
            placeholder="Record audio",
            key="audio_chat",
            max_chars=200,
            max_upload_size=50,
            accept_file=False,
            file_type=None,
            accept_audio=True,
            audio_sample_rate=48000,
            disabled=False,
            on_submit=my_callback,
            args=None,
            kwargs=None,
            width="stretch",
        ),
        ChatInputValue | None,
    )

    # =====================================================================
    # Test with all parameters combined (both file and audio - returns ChatInputValue | None)
    # =====================================================================

    assert_type(
        chat_input(
            placeholder="Files and audio",
            key="full_media_chat",
            max_chars=1000,
            max_upload_size=200,
            accept_file="multiple",
            file_type=["jpg", "png", "gif"],
            accept_audio=True,
            audio_sample_rate=44100,
            disabled=False,
            on_submit=my_callback,
            args=None,
            kwargs=None,
            width=800,
        ),
        ChatInputValue | None,
    )
