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

# Perform some "type checking testing"; mypy should flag any assignments that are
# incorrect.
if TYPE_CHECKING:
    import io
    from pathlib import Path

    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.form import FormMixin
    from streamlit.elements.widgets.button import ButtonMixin
    from streamlit.navigation.page import Page

    button = ButtonMixin().button
    download_button = ButtonMixin().download_button
    link_button = ButtonMixin().link_button
    page_link = ButtonMixin().page_link
    form_submit_button = FormMixin().form_submit_button

    # =====================================================================
    # st.button return type tests
    # =====================================================================

    # Basic button - returns bool
    assert_type(button("Click me"), bool)
    assert_type(button("Click me", key="my_button"), bool)
    assert_type(button("Click me", key=123), bool)

    # Button type parameter - Literal["primary", "secondary", "tertiary"]
    assert_type(button("Primary", type="primary"), bool)
    assert_type(button("Secondary", type="secondary"), bool)
    assert_type(button("Tertiary", type="tertiary"), bool)

    # Button with help parameter
    assert_type(button("Help", help="This is help text"), bool)
    assert_type(button("Help", help=None), bool)

    # Button with icon parameter
    assert_type(button("Icon", icon="🚨"), bool)
    assert_type(button("Icon", icon=":material/thumb_up:"), bool)
    assert_type(button("Icon", icon="spinner"), bool)
    assert_type(button("Icon", icon=None), bool)

    # Button with disabled parameter
    assert_type(button("Disabled", disabled=True), bool)
    assert_type(button("Enabled", disabled=False), bool)

    # Button with width parameter - "content", "stretch", or int
    assert_type(button("Content width", width="content"), bool)
    assert_type(button("Stretch width", width="stretch"), bool)
    assert_type(button("Fixed width", width=200), bool)

    # Button with shortcut parameter
    assert_type(button("Shortcut", shortcut="K"), bool)
    assert_type(button("Shortcut", shortcut="Ctrl+S"), bool)
    assert_type(button("Shortcut", shortcut=None), bool)

    # Button with on_click callback
    def my_callback() -> None:
        pass

    def callback_with_args(x: int, y: str) -> None:
        pass

    assert_type(button("Callback", on_click=my_callback), bool)
    assert_type(button("Callback", on_click=callback_with_args, args=(1, "a")), bool)
    assert_type(
        button("Callback", on_click=callback_with_args, kwargs={"x": 1, "y": "a"}), bool
    )
    assert_type(button("No callback", on_click=None), bool)

    # Button with all parameters combined
    assert_type(
        button(
            "Full button",
            key="full_button",
            help="Full help",
            on_click=my_callback,
            args=None,
            kwargs=None,
            type="primary",
            icon="🚀",
            disabled=False,
            width="stretch",
            shortcut="Enter",
        ),
        bool,
    )

    # =====================================================================
    # st.download_button return type tests
    # =====================================================================

    # Basic download button - returns bool
    assert_type(download_button("Download", data="text content"), bool)
    assert_type(download_button("Download", data=b"binary content"), bool)

    # Download button with different data types (TextIO, BinaryIO, RawIOBase)
    text_io = io.StringIO("text")
    binary_io = io.BytesIO(b"binary")
    raw_io: io.RawIOBase = io.FileIO("/dev/null")  # RawIOBase example
    assert_type(download_button("Download", data=text_io), bool)
    assert_type(download_button("Download", data=binary_io), bool)
    assert_type(download_button("Download", data=raw_io), bool)

    # Download button with callable data (deferred)
    def generate_data() -> bytes:
        return b"generated"

    def generate_text() -> str:
        return "generated"

    assert_type(download_button("Download", data=generate_data), bool)
    assert_type(download_button("Download", data=generate_text), bool)

    # Download button with file_name and mime
    assert_type(download_button("Download", data="content", file_name="file.txt"), bool)
    assert_type(download_button("Download", data="content", mime="text/plain"), bool)
    assert_type(
        download_button(
            "Download", data="content", file_name="file.csv", mime="text/csv"
        ),
        bool,
    )

    # Download button with on_click parameter - supports "rerun", "ignore", callable, or None
    assert_type(download_button("Download", data="content", on_click="rerun"), bool)
    assert_type(download_button("Download", data="content", on_click="ignore"), bool)
    assert_type(download_button("Download", data="content", on_click=my_callback), bool)
    assert_type(download_button("Download", data="content", on_click=None), bool)

    # Download button with type parameter
    assert_type(download_button("Download", data="content", type="primary"), bool)
    assert_type(download_button("Download", data="content", type="secondary"), bool)
    assert_type(download_button("Download", data="content", type="tertiary"), bool)

    # Download button with width parameter
    assert_type(download_button("Download", data="content", width="content"), bool)
    assert_type(download_button("Download", data="content", width="stretch"), bool)
    assert_type(download_button("Download", data="content", width=150), bool)

    # Download button with icon, disabled, help, key (str or int), shortcut
    assert_type(download_button("Download", data="content", icon="📥"), bool)
    assert_type(download_button("Download", data="content", disabled=True), bool)
    assert_type(download_button("Download", data="content", help="Help text"), bool)
    assert_type(download_button("Download", data="content", key="dl_key"), bool)
    assert_type(download_button("Download", data="content", key=456), bool)
    assert_type(download_button("Download", data="content", shortcut="Ctrl+D"), bool)

    # Download button with all parameters combined
    assert_type(
        download_button(
            "Full download",
            data=b"content",
            file_name="file.bin",
            mime="application/octet-stream",
            key="full_download",
            help="Download this file",
            on_click="ignore",
            args=None,
            kwargs=None,
            type="primary",
            icon=":material/download:",
            disabled=False,
            width="stretch",
            shortcut="Ctrl+Shift+D",
        ),
        bool,
    )

    # =====================================================================
    # st.link_button return type tests
    # =====================================================================

    # Basic link button - returns DeltaGenerator
    assert_type(link_button("Google", "https://google.com"), DeltaGenerator)
    assert_type(
        link_button("Google", "https://google.com", key="link_key"), DeltaGenerator
    )
    assert_type(link_button("Google", "https://google.com", key=789), DeltaGenerator)

    # Link button with type parameter
    assert_type(
        link_button("Link", "https://example.com", type="primary"), DeltaGenerator
    )
    assert_type(
        link_button("Link", "https://example.com", type="secondary"), DeltaGenerator
    )
    assert_type(
        link_button("Link", "https://example.com", type="tertiary"), DeltaGenerator
    )

    # Link button with help parameter
    assert_type(
        link_button("Link", "https://example.com", help="Click to visit"),
        DeltaGenerator,
    )
    assert_type(link_button("Link", "https://example.com", help=None), DeltaGenerator)

    # Link button with icon parameter
    assert_type(link_button("Link", "https://example.com", icon="🔗"), DeltaGenerator)
    assert_type(
        link_button("Link", "https://example.com", icon=":material/link:"),
        DeltaGenerator,
    )
    assert_type(link_button("Link", "https://example.com", icon=None), DeltaGenerator)

    # Link button with disabled parameter
    assert_type(
        link_button("Link", "https://example.com", disabled=True), DeltaGenerator
    )
    assert_type(
        link_button("Link", "https://example.com", disabled=False), DeltaGenerator
    )

    # Link button with width parameter
    assert_type(
        link_button("Link", "https://example.com", width="content"), DeltaGenerator
    )
    assert_type(
        link_button("Link", "https://example.com", width="stretch"), DeltaGenerator
    )
    assert_type(link_button("Link", "https://example.com", width=250), DeltaGenerator)

    # Link button with shortcut parameter
    assert_type(
        link_button("Link", "https://example.com", shortcut="L"), DeltaGenerator
    )
    assert_type(
        link_button("Link", "https://example.com", shortcut="Ctrl+L"), DeltaGenerator
    )
    assert_type(
        link_button("Link", "https://example.com", shortcut=None), DeltaGenerator
    )

    # Link button with on_click parameter - supports "rerun", "ignore", or callable
    assert_type(
        link_button("Link", "https://example.com", on_click="ignore"), DeltaGenerator
    )
    assert_type(link_button("Link", "https://example.com", on_click="rerun"), bool)
    assert_type(link_button("Link", "https://example.com", on_click=my_callback), bool)
    assert_type(
        link_button(
            "Link",
            "https://example.com",
            on_click=callback_with_args,
            args=(1, "a"),
        ),
        bool,
    )
    assert_type(
        link_button(
            "Link",
            "https://example.com",
            on_click=callback_with_args,
            kwargs={"x": 1, "y": "a"},
        ),
        bool,
    )

    # Link button with all parameters combined
    assert_type(
        link_button(
            "Full link",
            "https://streamlit.io",
            key="full_link",
            on_click=my_callback,
            args=None,
            kwargs=None,
            help="Visit Streamlit",
            type="primary",
            icon="🚀",
            disabled=False,
            width="stretch",
            shortcut="Ctrl+Shift+S",
        ),
        bool,
    )

    # =====================================================================
    # st.page_link return type tests
    # =====================================================================

    # Basic page link - returns DeltaGenerator
    # page parameter accepts str, Path, or StreamlitPage
    assert_type(page_link("pages/page1.py"), DeltaGenerator)
    assert_type(page_link(Path("pages/page1.py")), DeltaGenerator)
    assert_type(page_link("https://example.com", label="External"), DeltaGenerator)

    # Page link with StreamlitPage object
    streamlit_page = Page("page1.py")
    assert_type(page_link(streamlit_page), DeltaGenerator)

    # Page link with label
    assert_type(page_link("pages/page1.py", label="Page 1"), DeltaGenerator)
    assert_type(page_link("pages/page1.py", label=None), DeltaGenerator)

    # Page link with icon
    assert_type(page_link("pages/page1.py", icon="📄"), DeltaGenerator)
    assert_type(page_link("pages/page1.py", icon=":material/article:"), DeltaGenerator)
    assert_type(page_link("pages/page1.py", icon=None), DeltaGenerator)

    # Page link with help
    assert_type(page_link("pages/page1.py", help="Go to page 1"), DeltaGenerator)
    assert_type(page_link("pages/page1.py", help=None), DeltaGenerator)

    # Page link with disabled
    assert_type(page_link("pages/page1.py", disabled=True), DeltaGenerator)
    assert_type(page_link("pages/page1.py", disabled=False), DeltaGenerator)

    # Page link with width
    assert_type(page_link("pages/page1.py", width="content"), DeltaGenerator)
    assert_type(page_link("pages/page1.py", width="stretch"), DeltaGenerator)
    assert_type(page_link("pages/page1.py", width=200), DeltaGenerator)

    # Page link with query_params
    assert_type(
        page_link("pages/page1.py", query_params={"key": "value"}), DeltaGenerator
    )
    assert_type(
        page_link("pages/page1.py", query_params=[("key", "value")]), DeltaGenerator
    )
    assert_type(page_link("pages/page1.py", query_params=None), DeltaGenerator)

    # Page link with all parameters combined
    assert_type(
        page_link(
            "pages/page1.py",
            label="Page 1",
            icon="📄",
            help="Navigate to page 1",
            disabled=False,
            width="stretch",
            query_params={"utm_source": "app"},
        ),
        DeltaGenerator,
    )

    # =====================================================================
    # st.form_submit_button return type tests
    # =====================================================================

    # Basic form submit button - returns bool
    assert_type(form_submit_button(), bool)
    assert_type(form_submit_button("Submit"), bool)

    # Form submit button with key
    assert_type(form_submit_button("Submit", key="submit_key"), bool)
    assert_type(form_submit_button("Submit", key=123), bool)
    assert_type(form_submit_button("Submit", key=None), bool)

    # Form submit button with help
    assert_type(form_submit_button("Submit", help="Click to submit"), bool)
    assert_type(form_submit_button("Submit", help=None), bool)

    # Form submit button with type parameter
    assert_type(form_submit_button("Submit", type="primary"), bool)
    assert_type(form_submit_button("Submit", type="secondary"), bool)
    assert_type(form_submit_button("Submit", type="tertiary"), bool)

    # Form submit button with icon
    assert_type(form_submit_button("Submit", icon="✅"), bool)
    assert_type(form_submit_button("Submit", icon=":material/send:"), bool)
    assert_type(form_submit_button("Submit", icon=None), bool)

    # Form submit button with disabled
    assert_type(form_submit_button("Submit", disabled=True), bool)
    assert_type(form_submit_button("Submit", disabled=False), bool)

    # Form submit button with width
    assert_type(form_submit_button("Submit", width="content"), bool)
    assert_type(form_submit_button("Submit", width="stretch"), bool)
    assert_type(form_submit_button("Submit", width=150), bool)

    # Form submit button with shortcut
    assert_type(form_submit_button("Submit", shortcut="Enter"), bool)
    assert_type(form_submit_button("Submit", shortcut="Ctrl+Enter"), bool)
    assert_type(form_submit_button("Submit", shortcut=None), bool)

    # Form submit button with on_click callback
    assert_type(form_submit_button("Submit", on_click=my_callback), bool)
    assert_type(
        form_submit_button("Submit", on_click=callback_with_args, args=(1, "a")), bool
    )
    assert_type(
        form_submit_button(
            "Submit", on_click=callback_with_args, kwargs={"x": 1, "y": "a"}
        ),
        bool,
    )
    assert_type(form_submit_button("Submit", on_click=None), bool)

    # Form submit button with all parameters combined
    assert_type(
        form_submit_button(
            "Full Submit",
            help="Submit the form",
            on_click=my_callback,
            args=None,
            kwargs=None,
            key="full_submit",
            type="primary",
            icon="🚀",
            disabled=False,
            width="stretch",
            shortcut="Ctrl+Enter",
        ),
        bool,
    )
