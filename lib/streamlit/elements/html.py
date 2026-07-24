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

import re
from pathlib import Path
from typing import TYPE_CHECKING, Final, cast

from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.deprecation_util import show_deprecation_warning
from streamlit.elements.lib.layout_utils import create_layout_config
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Html_pb2 import Html as HtmlProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text
from streamlit.type_util import SupportsReprHtml, SupportsStr, has_callable_attr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import Width

_STRING_FILE_PATH_WARNING: Final = (
    "Passing a local file path as a string to `st.html` is no longer supported. "
    "To load a local file, pass a `pathlib.Path` object instead."
)

# Maximum path length to check - skip filesystem calls for obviously long
# strings that are likely HTML content. Most OS path limits are 256-4096 chars.
_MAX_PATH_LENGTH: Final = 4096


class HtmlMixin:
    @gather_metrics("html")
    def html(
        self,
        body: str | Path | SupportsStr | SupportsReprHtml,
        *,  # keyword-only arguments:
        width: Width = "stretch",
        unsafe_allow_javascript: bool = False,
    ) -> DeltaGenerator:
        """Insert HTML into your app.

        Adding custom HTML to your app impacts safety, styling, and
        maintainability. We sanitize HTML with `DOMPurify
        <https://github.com/cure53/DOMPurify>`_, but inserting HTML remains a
        developer risk. Passing untrusted code to ``st.html`` or dynamically
        loading external code can increase the risk of vulnerabilities in your
        app.

        ``st.html`` content is **not** iframed. By default, JavaScript is
        ignored. To execute JavaScript contained in your HTML, set
        ``unsafe_allow_javascript=True``. Use this with caution and never pass
        untrusted input.

        Parameters
        ----------
        body : any
            The HTML code to insert. This can be one of the following:

            - A string of HTML code.
            - A ``pathlib.Path`` object pointing to a local file with HTML
              code. Paths can be absolute or relative to the working directory
              (where you execute ``streamlit run``). Local file paths passed
              as strings are treated as HTML content.
            - Any object. If ``body`` is not a string or path, Streamlit will
              convert the object to a string. ``body._repr_html_()`` takes
              precedence over ``str(body)`` when available.

            If the resulting HTML content is empty, Streamlit will raise an
            error.

            If ``body`` is a ``Path`` to a CSS file, Streamlit will wrap the
            CSS content in ``<style>`` tags automatically. When the resulting
            HTML content only contains style tags, Streamlit will send the
            content to the event container instead of the main container to
            avoid taking up space in the app.

        width : "stretch", "content", or int
            The width of the HTML element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        unsafe_allow_javascript : bool
            Whether to execute JavaScript contained in your HTML. If this is
            ``False`` (default), JavaScript is ignored. If this is ``True``,
            JavaScript is executed. Use this with caution and never pass
            untrusted input.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.html(
        ...     "<p><span style='text-decoration: line-through double red;'>Oops</span>!</p>"
        ... )

        .. output::
           https://doc-html.streamlit.app/
           height: 300px

        """
        html_proto = HtmlProto()

        # If body supports _repr_html_, use that.
        if has_callable_attr(body, "_repr_html_"):
            html_content = cast("SupportsReprHtml", body)._repr_html_()

        # Path objects explicitly opt in to reading from the local filesystem.
        elif isinstance(body, Path):
            file_path = str(body)
            with open(file_path, encoding="utf-8") as f:
                html_content = f.read()

            # If it's a CSS file, wrap the content in style tags
            if Path(file_path).suffix.lower() == ".css":
                html_content = f"<style>{html_content}</style>"

        # Keep the filesystem lookup temporarily so existing string paths can
        # receive a migration warning, but never read from a string path.
        elif isinstance(body, str) and _is_file(body):
            show_deprecation_warning(_STRING_FILE_PATH_WARNING)
            html_content = clean_text(body)

        # OK, let's just try converting to string and hope for the best.
        else:
            html_content = clean_text(cast("SupportsStr", body))

        # Raise an error if the body is empty
        if html_content == "":
            raise StreamlitAPIException("`st.html` body cannot be empty")

        layout_config = create_layout_config(width=width, allow_content_width=True)

        # Handle the case where there are only style tags - issue #9388
        # Use event container for style tags so they don't take up space in the app content
        if _html_only_style_tags(html_content):
            # If true, there are only style tags - send html to the event container
            html_proto.body = html_content
            return self._event_dg._enqueue("html", html_proto)
        # Otherwise, send the html to the main container as normal
        # Only set the unsafe JS flag for non-style-only HTML content
        html_proto.unsafe_allow_javascript = unsafe_allow_javascript
        html_proto.body = html_content
        return self.dg._enqueue("html", html_proto, layout_config=layout_config)

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)

    @property
    def _event_dg(self) -> DeltaGenerator:
        """The event delta generator."""
        return get_dg_singleton_instance().event_dg


def _html_only_style_tags(html_content: str) -> bool:
    """Check if the HTML content is only style tags."""
    # Pattern to match HTML comments
    comment_pattern = r"<!--.*?-->"
    # Pattern to match style tags and their contents (case-insensitive)
    style_pattern = r"<style[^>]*>.*?</style>"

    # Remove style tags and comments
    html_without_comments = re.sub(comment_pattern, "", html_content, flags=re.DOTALL)
    html_without_styles_and_comments = re.sub(
        style_pattern, "", html_without_comments, flags=re.DOTALL | re.IGNORECASE
    )

    # Return whether html content is empty after removing style tags and comments
    return html_without_styles_and_comments.strip() == ""


def _is_file(obj: str) -> bool:
    """Check if obj is a file path, without throwing if not."""
    # Skip the filesystem check for long strings (likely HTML content) or
    # strings containing '<' (likely HTML tags) to avoid unnecessary I/O.
    if len(obj) > _MAX_PATH_LENGTH or "<" in obj:
        return False

    try:
        return Path(obj).is_file()
    except (TypeError, OSError, ValueError):
        # ValueError can be raised on some platforms for strings with null bytes.
        return False
