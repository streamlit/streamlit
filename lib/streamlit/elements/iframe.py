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
import os
from pathlib import Path
from typing import TYPE_CHECKING, Literal, cast

from streamlit import runtime
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

_HTML_EXTENSIONS = {".html", ".htm", ".xhtml"}

_CONTENT_HEIGHT_FALLBACK = 400


def _is_url(src: str) -> bool:
    """Check if the string is a URL (absolute or relative)."""
    return src.startswith(("http://", "https://", "data:", "/"))


def _is_html_file(path: Path) -> bool:
    """Check if the file path has an HTML extension."""
    return path.suffix.lower() in _HTML_EXTENSIONS


class IframeMixin:
    @gather_metrics("iframe")
    def iframe(
        self,
        src: str | Path,
        *,
        width: int | Literal["stretch", "content"] = "stretch",
        height: int | Literal["stretch", "content"] = "content",
        tab_index: int | None = None,
    ) -> DeltaGenerator:
        r"""Embed content in an iframe.

        Display a URL, local file, or HTML string inside an iframe element.
        Streamlit auto-detects the input type and handles it appropriately.

        Parameters
        ----------
        src : str or Path
            Content to embed. Streamlit auto-detects the type:

            - **Absolute URL**: Starts with ``http://``, ``https://``, or
              ``data:``. Loaded directly in the iframe.
            - **Relative URL**: Starts with ``/``. Useful for referencing
              static files served by Streamlit.
            - **Local file path**: A ``Path`` object or a string that resolves
              to an existing file. HTML files (``.html``, ``.htm``, ``.xhtml``)
              are read and embedded via ``srcdoc``. Other files (PDF, images,
              SVG, etc.) are served through media storage and loaded via
              ``src``.
            - **HTML string**: Any other string is treated as inline HTML and
              embedded via ``srcdoc``.

        width : int, "stretch", or "content"
            Width of the iframe in CSS pixels, ``"stretch"`` to fill
            the container width (default), or ``"content"`` to match the
            content width.

        height : int, "stretch", or "content"
            Height of the iframe in CSS pixels, ``"stretch"`` to fill the
            container height, or ``"content"`` (default) to auto-size to
            the content. For URLs and non-HTML local files, ``"content"``
            falls back to 400px because cross-origin restrictions prevent
            content measurement.

        tab_index : int or None
            Controls sequential focus navigation. See `tabindex
            <https://developer.mozilla.org/en-US/docs/Web/HTML/Global_attributes/tabindex>`_
            documentation on MDN.

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

        Examples
        --------
        Embed an external website:

        .. code-block:: python
            :filename: streamlit_app.py

            import streamlit as st

            st.iframe("https://docs.streamlit.io", height=600)

        Embed HTML content directly:

        .. code-block:: python
            :filename: streamlit_app.py

            import streamlit as st

            st.iframe(
                "<h1>Hello World</h1><p>This is embedded HTML.</p>",
                height=100,
            )

        Embed a local HTML file:

        .. code-block:: python
            :filename: streamlit_app.py

            import streamlit as st
            from pathlib import Path

            st.iframe(Path("reports/analysis.html"), height=800)

        .. output::
            https://doc-iframe.streamlit.app/

        """
        validate_width(width, allow_content=True)
        validate_height(height, allow_content=True)

        iframe_proto = IFrameProto()
        is_srcdoc = False

        if isinstance(src, Path):
            is_srcdoc = self._handle_local_file(src, iframe_proto)
        elif _is_url(src):
            iframe_proto.src = src
        elif os.path.isfile(src):
            is_srcdoc = self._handle_local_file(Path(src), iframe_proto)
        else:
            iframe_proto.srcdoc = src
            is_srcdoc = True

        iframe_proto.scrolling = True

        if tab_index is not None:
            if not (
                isinstance(tab_index, int)
                and not isinstance(tab_index, bool)
                and tab_index >= -1
            ):
                raise StreamlitAPIException(
                    "tab_index must be None, -1, or a non-negative integer."
                )
            iframe_proto.tab_index = tab_index

        resolved_height = height
        if height == "content":
            if is_srcdoc:
                iframe_proto.content_height = True
            else:
                resolved_height = _CONTENT_HEIGHT_FALLBACK

        layout_config = LayoutConfig(
            width=width,
            height=resolved_height,
        )
        return self.dg._enqueue("iframe", iframe_proto, layout_config=layout_config)

    def _handle_local_file(
        self,
        path: Path,
        proto: IFrameProto,
    ) -> bool:
        """Read a local file and populate the proto.

        Returns True if the content was embedded as srcdoc (HTML files),
        False if served via media storage URL.
        """
        if not path.is_file():
            raise StreamlitAPIException(
                f"File not found: `{path}`. Make sure the path is correct "
                f"and the file exists relative to the working directory."
            )

        if _is_html_file(path):
            proto.srcdoc = path.read_text(encoding="utf-8")
            return True

        data = path.read_bytes()
        mimetype, _ = mimetypes.guess_type(str(path))
        if mimetype is None:
            mimetype = "application/octet-stream"

        coordinates = self.dg._get_delta_path_str()
        if runtime.exists():
            file_url = runtime.get_instance().media_file_mgr.add(
                data, mimetype, coordinates
            )
            caching.save_media_data(data, mimetype, coordinates)
        else:
            file_url = ""

        proto.src = file_url
        return False

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

    if tab_index is not None:
        # Validate tab_index according to web specifications
        if not (
            isinstance(tab_index, int)
            and not isinstance(tab_index, bool)
            and tab_index >= -1
        ):
            raise StreamlitAPIException(
                "tab_index must be None, -1, or a non-negative integer."
            )

        proto.tab_index = tab_index
