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

import mimetypes
from pathlib import Path
from typing import TYPE_CHECKING, Final, Literal, cast

from streamlit import runtime, url_util
from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    validate_height,
    validate_width,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto
from streamlit.runtime import caching
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

# File extensions that are treated as HTML and embedded via srcdoc
_HTML_EXTENSIONS: Final = frozenset({".html", ".htm", ".xhtml"})

# Maximum path length to check - skip filesystem calls for obviously long strings
# that are likely HTML content. Most OS path limits are 256-4096 characters.
_MAX_PATH_LENGTH: Final = 4096


def _is_file(obj: str) -> bool:
    """Check if obj is a file path, without throwing if not."""

    # Skip filesystem check for long strings (likely HTML content) or strings
    # containing '<' (likely HTML tags) to avoid unnecessary I/O
    if len(obj) > _MAX_PATH_LENGTH or "<" in obj:
        return False

    try:
        return Path(obj).is_file()
    except (TypeError, OSError, ValueError):
        # ValueError can be raised on some platforms for strings with null bytes
        return False


def _validate_tab_index(tab_index: int | None) -> None:
    """Validate tab_index according to web specifications."""
    if tab_index is None:
        return
    if not (
        isinstance(tab_index, int)
        and not isinstance(tab_index, bool)
        and tab_index >= -1
    ):
        raise StreamlitAPIException(
            "tab_index must be None, -1, or a non-negative integer."
        )


class IframeMixin:
    @gather_metrics("_iframe")
    def _iframe(
        self,
        src: str,
        width: int | None = None,
        height: int | None = None,
        scrolling: bool = False,
        *,
        tab_index: int | None = None,
    ) -> DeltaGenerator:
        """Load a remote URL in an iframe.

        To use this function, import it from the ``streamlit.components.v1``
        module.

        .. deprecated::
            ``st.components.v1.iframe`` is deprecated and will be removed in a
            future release. Please use ``st.iframe`` instead, which provides
            the same functionality with additional features like automatic
            content sizing and local file support.

        .. warning::
            Using ``st.components.v1.iframe`` directly (instead of importing
            its module) is deprecated and will be disallowed in a later version.

        Parameters
        ----------
        src : str
            The URL of the page to embed.

        width : int
            The width of the iframe in CSS pixels. By default, this is the
            app's default element width.

        height : int
            The height of the frame in CSS pixels. By default, this is ``150``.

        scrolling : bool
            Whether to allow scrolling in the iframe. If this ``False``
            (default), Streamlit crops any content larger than the iframe and
            does not show a scrollbar. If this is ``True``, Streamlit shows a
            scrollbar when the content is larger than the iframe.

        tab_index : int or None
            Specifies how and if the iframe is sequentially focusable.
            Users typically use the ``Tab`` key for sequential focus
            navigation.

            This can be one of the following values:

            - ``None`` (default): Uses the browser's default behavior.
            - ``-1``: Removes the iframe from sequential navigation, but still
              allows it to be focused programmatically.
            - ``0``: Includes the iframe in sequential navigation in the order
              it appears in the document but after all elements with a positive
              ``tab_index``.
            - Positive integer: Includes the iframe in sequential navigation.
              Elements are navigated in ascending order of their positive
              ``tab_index``.

            For more information, see the `tabindex
            <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex>`_
            documentation on MDN.

        Examples
        --------
        >>> import streamlit.components.v1 as components
        >>>
        >>> components.iframe("https://example.com", height=500)

        """
        iframe_proto = IFrameProto()
        marshall(
            iframe_proto,
            src=src,
            scrolling=scrolling,
            tab_index=tab_index,
        )
        layout_config = LayoutConfig(
            width=width if width is not None else "stretch",
            height=height if height is not None else 150,
        )
        return self.dg._enqueue("iframe", iframe_proto, layout_config=layout_config)

    @gather_metrics("_html")
    def _html(
        self,
        html: str,
        width: int | None = None,
        height: int | None = None,
        scrolling: bool = False,
        *,
        tab_index: int | None = None,
    ) -> DeltaGenerator:
        """Display an HTML string in an iframe.

        To use this function, import it from the ``streamlit.components.v1``
        module.

        If you want to insert HTML text into your app without an iframe, try
        ``st.html`` instead.

        .. deprecated::
            ``st.components.v1.html`` is deprecated and will be removed in a
            future release. Please use ``st.iframe`` instead, which provides
            the same functionality with additional features like automatic
            content sizing and local file support.

        .. warning::
            Using ``st.components.v1.html`` directly (instead of importing
            its module) is deprecated and will be disallowed in a later version.

        Parameters
        ----------
        html : str
            The HTML string to embed in the iframe.

        width : int
            The width of the iframe in CSS pixels. By default, this is the
            app's default element width.

        height : int
            The height of the frame in CSS pixels. By default, this is ``150``.

        scrolling : bool
            Whether to allow scrolling in the iframe. If this ``False``
            (default), Streamlit crops any content larger than the iframe and
            does not show a scrollbar. If this is ``True``, Streamlit shows a
            scrollbar when the content is larger than the iframe.

        tab_index : int or None
            Specifies how and if the iframe is sequentially focusable.
            Users typically use the ``Tab`` key for sequential focus
            navigation.

            This can be one of the following values:

            - ``None`` (default): Uses the browser's default behavior.
            - ``-1``: Removes the iframe from sequential navigation, but still
              allows it to be focused programmatically.
            - ``0``: Includes the iframe in sequential navigation in the order
              it appears in the document but after all elements with a positive
              ``tab_index``.
            - Positive integer: Includes the iframe in sequential navigation.
              Elements are navigated in ascending order of their positive
              ``tab_index``.

            For more information, see the `tabindex
            <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex>`_
            documentation on MDN.

        Examples
        --------
        >>> import streamlit.components.v1 as components
        >>>
        >>> components.html(
        >>>     "<p><span style='text-decoration: line-through double red;'>Oops</span>!</p>"
        >>> )

        """
        iframe_proto = IFrameProto()
        marshall(
            iframe_proto,
            srcdoc=html,
            scrolling=scrolling,
            tab_index=tab_index,
        )
        layout_config = LayoutConfig(
            width=width if width is not None else "stretch",
            height=height if height is not None else 150,
        )
        return self.dg._enqueue("iframe", iframe_proto, layout_config=layout_config)

    @gather_metrics("iframe")
    def iframe(
        self,
        src: str | Path,
        *,
        width: int | Literal["stretch", "content"] = "stretch",
        height: int | Literal["stretch", "content"] = "content",
        tab_index: int | None = None,
    ) -> DeltaGenerator:
        """Embed content in an iframe.

        ``st.iframe`` embeds external URLs, HTML content, or local files in an
        iframe. It auto-detects the input type and handles it appropriately.

        Parameters
        ----------
        src : str or Path
            The content to embed. This can be one of the following:

            - **Absolute URL**: A URL starting with ``http://``, ``https://``,
              or ``data:``. The URL is loaded directly in the iframe.
            - **Relative URL**: A path starting with ``/``, such as
              ``/app/static/report.html``. Useful for referencing files served
              via Streamlit's `static file serving
              <https://docs.streamlit.io/develop/concepts/configuration/serving-static-files>`_.
            - **Local file path**: A path to a local file, either as a string
              or ``Path`` object. HTML files (``.html``, ``.htm``, ``.xhtml``)
              are read and embedded directly. Other files (PDF, images, SVG,
              etc.) are uploaded to Streamlit's media storage and rendered
              using the browser's native viewer.
            - **HTML string**: If ``src`` doesn't match any of the above
              patterns, it's treated as raw HTML and embedded directly in the
              iframe.

        width : int, "stretch", or "content"
            The width of the iframe. This can be one of the following:

            - ``"stretch"`` (default): The iframe fills the width of its
              container.
            - ``"content"``: The iframe matches the width of its content.
            - An ``int``: A fixed width in CSS pixels.

        height : int, "stretch", or "content"
            The height of the iframe. This can be one of the following:

            - ``"content"`` (default): The iframe automatically sizes to match
              its content height. For HTML strings and local HTML files,
              Streamlit measures the content height. For external URLs and
              non-HTML files, this falls back to 400px due to cross-origin
              restrictions.
            - ``"stretch"``: The iframe fills the available vertical space.
              Works best inside containers with defined heights.
            - An ``int``: A fixed height in CSS pixels.

        tab_index : int or None
            Controls keyboard navigation focus. This can be one of the
            following:

            - ``None`` (default): Browser default behavior.
            - ``-1``: Removes from tab order but allows programmatic focus.
            - ``0``: Adds to tab order in document position.
            - Positive ``int``: Adds to tab order at specified priority.

            For more information, see the `tabindex
            <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex>`_
            documentation on MDN.

        Examples
        --------
        Embed an external website:

        >>> import streamlit as st
        >>> st.iframe("https://docs.streamlit.io", height=600)

        Embed HTML content directly:

        >>> import streamlit as st
        >>> st.iframe(
        ...     '''
        ...     <style>body { font-family: sans-serif; padding: 1rem; }</style>
        ...     <p>This is <strong>embedded HTML</strong>.</p>
        ...     ''',
        ...     height=100,
        ... )

        Embed a local HTML file:

        >>> import streamlit as st
        >>> from pathlib import Path
        >>> st.iframe(Path("reports/dashboard.html"), height=800)

        """

        validate_width(width, allow_content=True)
        validate_height(height, allow_content=True)

        iframe_proto = IFrameProto()

        # Track whether content can be measured (srcdoc) or not (URL)
        uses_srcdoc = False

        # Determine input type: Path object > absolute URL > existing file > relative URL > HTML string
        src_str = str(src) if isinstance(src, Path) else src

        if isinstance(src, Path):
            uses_srcdoc = self._process_local_file(
                iframe_proto, src_str, self.dg._get_delta_path_str()
            )
        elif url_util.is_url(src_str, allowed_schemas=("http", "https", "data")):
            iframe_proto.src = src_str
        elif _is_file(src_str):
            # Check for existing file before relative URL to handle Unix paths
            uses_srcdoc = self._process_local_file(
                iframe_proto, src_str, self.dg._get_delta_path_str()
            )
        elif src_str.startswith("/"):
            # Relative URL - /-prefixed strings that aren't existing files
            iframe_proto.src = src_str
        else:
            iframe_proto.srcdoc = src_str
            uses_srcdoc = True

        iframe_proto.scrolling = True

        _validate_tab_index(tab_index)
        if tab_index is not None:
            iframe_proto.tab_index = tab_index

        # For URLs (not srcdoc), "content" sizing falls back because cross-origin
        # content cannot be measured. Height falls back to 400px, width to stretch.
        effective_width = width
        effective_height = height
        if not uses_srcdoc:
            if width == "content":
                effective_width = "stretch"
            if height == "content":
                effective_height = 400

        layout_config = LayoutConfig(width=effective_width, height=effective_height)

        return self.dg._enqueue("iframe", iframe_proto, layout_config=layout_config)

    def _process_local_file(
        self, proto: IFrameProto, file_path: str, coordinates: str
    ) -> bool:
        """Process a local file for embedding in the iframe.

        Parameters
        ----------
        proto : IFrameProto
            The proto to populate with src or srcdoc.
        file_path : str
            Path to the local file.
        coordinates : str
            The element coordinates for media file tracking.

        Returns
        -------
        bool
            True if the file was embedded via srcdoc (HTML), False if via src (URL).

        Raises
        ------
        StreamlitAPIException
            If the file cannot be read.
        """

        path = Path(file_path)
        suffix = path.suffix.lower()

        if suffix in _HTML_EXTENSIONS:
            # HTML files: read and embed via srcdoc
            try:
                with open(file_path, encoding="utf-8") as f:
                    proto.srcdoc = f.read()
            except (
                FileNotFoundError,
                PermissionError,
                OSError,
                UnicodeDecodeError,
            ) as e:
                raise StreamlitAPIException(
                    f"Unable to read file '{file_path}': {e}"
                ) from e
            return True
        # Non-HTML files: upload to media storage
        try:
            with open(file_path, "rb") as f:
                file_data = f.read()
        except (FileNotFoundError, PermissionError, OSError) as e:
            raise StreamlitAPIException(
                f"Unable to read file '{file_path}': {e}"
            ) from e

        mimetype, _ = mimetypes.guess_type(file_path)

        if runtime.exists():
            file_url = runtime.get_instance().media_file_mgr.add(
                file_data, mimetype or "application/octet-stream", coordinates
            )
            caching.save_media_data(
                file_data, mimetype or "application/octet-stream", coordinates
            )
            proto.src = file_url
        else:
            # Raw mode: can't access MediaFileManager
            proto.src = ""
        return False

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)


def marshall(
    proto: IFrameProto,
    src: str | None = None,
    srcdoc: str | None = None,
    scrolling: bool = False,
    tab_index: int | None = None,
) -> None:
    """Marshalls data into an IFrame proto.

    These parameters correspond directly to <iframe> attributes, which are
    described in more detail at
    https://developer.mozilla.org/en-US/docs/Web/HTML/Element/iframe.

    Parameters
    ----------
    proto : IFrame protobuf
        The protobuf object to marshall data into.
    src : str
        The URL of the page to embed.
    srcdoc : str
        Inline HTML to embed. Overrides src.
    scrolling : bool
        If true, show a scrollbar when the content is larger than the iframe.
        Otherwise, never show a scrollbar.
    tab_index : int, optional
        Specifies the tab order of the iframe.

    """
    if src is not None:
        proto.src = src

    if srcdoc is not None:
        proto.srcdoc = srcdoc

    proto.scrolling = scrolling

    _validate_tab_index(tab_index)
    if tab_index is not None:
        proto.tab_index = tab_index
