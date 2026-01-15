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

import os
import re
from pathlib import Path
from typing import TYPE_CHECKING, Any, cast

from streamlit.delta_generator_singletons import get_dg_singleton_instance
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    validate_width,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Html_pb2 import Html as HtmlProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text
from streamlit.type_util import SupportsReprHtml, SupportsStr, has_callable_attr

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


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
            - A path to a local file with HTML code. The path can be a ``str``
              or ``Path`` object. Paths can be absolute or relative to the
              working directory (where you execute ``streamlit run``).
            - Any object. If ``body`` is not a string or path, Streamlit will
              convert the object to a string. ``body._repr_html_()`` takes
              precedence over ``str(body)`` when available.

            If the resulting HTML content is empty, Streamlit will raise an
            error.

            If ``body`` is a path to a CSS file, Streamlit will wrap the CSS
            content in ``<style>`` tags automatically. When the resulting HTML
            content only contains style tags, Streamlit will send the content
            to the event container instead of the main container to avoid
            taking up space in the app.

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

        Example
        -------
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

        # Check if the body is a file path. May include filesystem lookup.
        elif isinstance(body, Path) or _is_file(body):
            file_path = str(body)
            with open(file_path, encoding="utf-8") as f:
                html_content = f.read()

            # If it's a CSS file, wrap the content in style tags
            if Path(file_path).suffix.lower() == ".css":
                html_content = f"<style>{html_content}</style>"

        # OK, let's just try converting to string and hope for the best.
        else:
            html_content = clean_text(cast("SupportsStr", body))

        # Raise an error if the body is empty
        if html_content == "":
            raise StreamlitAPIException("`st.html` body cannot be empty")

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

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
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

    @property
    def _event_dg(self) -> DeltaGenerator:
        """Get the event delta generator."""
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


def _is_file(obj: Any) -> bool:
    """Checks if obj is a file, and doesn't throw if not.

    The "not throwing" part is important!
    """
    try:
        return os.path.isfile(obj)
    except TypeError:
        return False
