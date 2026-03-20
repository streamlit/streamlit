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
from typing import TYPE_CHECKING, Final, cast

from streamlit import runtime
from streamlit.deprecation_util import show_deprecation_warning
from streamlit.elements.lib.layout_utils import (
    Height,
    LayoutConfig,
    Width,
    validate_height,
    validate_width,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto
from streamlit.runtime import caching
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator

_HTML_FILE_EXTENSIONS: Final = {".htm", ".html", ".xhtml"}
_URL_PREFIXES: Final = ("http://", "https://", "data:", "/")
_CONTENT_HEIGHT_FALLBACK_PX: Final = 400
_COMPONENTS_V1_IFRAME_DEPRECATION_WARNING: Final = (
    "The `st.components.v1.iframe` and `st.components.v1.html` functions are "
    "deprecated and will be removed in a future release. Use `st.iframe` instead."
)


class IframeMixin:
    @gather_metrics("iframe")
    def iframe(
        self,
        src: str | Path,
        *,
        width: Width = "stretch",
        height: Height = "content",
        tab_index: int | None = None,
    ) -> DeltaGenerator:
        r"""Embed content in an iframe.

        ``st.iframe`` can embed a URL, a local file, or inline HTML in an
        iframe. This includes support for local HTML files, PDFs, images, SVGs,
        and other files that the browser can render natively.

        Unlike ``st.html``, ``st.iframe`` always renders content inside an
        iframe with Streamlit's default sandbox and permissions policy.

        Parameters
        ----------
        src : str or Path
            The content to embed. Streamlit detects the input type in this
            order:

            - A ``Path`` object is treated as a local file path.
            - A string starting with ``http://``, ``https://``, ``data:``, or
              ``/`` is treated as a URL.
            - A string that resolves to an existing local file is treated as a
              local file path.
            - Any other string is treated as inline HTML and embedded with
              ``srcdoc``.

        width : "stretch", "content", or int
            The width of the iframe. This can be one of the following:

            - ``"stretch"`` (default): The iframe matches the width of its
              parent container.
            - ``"content"``: The iframe shrinks to fit its content when
              possible.
            - An integer specifying the width in pixels: The iframe has a fixed
              width.

        height : "stretch", "content", or int
            The height of the iframe. This can be one of the following:

            - ``"content"`` (default): The iframe matches the height of its
              content when possible. For URLs and non-HTML local files,
              ``"content"`` falls back to ``400`` pixels because browsers
              restrict measuring iframe content in those cases.
            - ``"stretch"``: The iframe fills the available vertical space.
            - An integer specifying the height in pixels: The iframe has a
              fixed height.

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
        .. code-block:: python
           :filename: streamlit_app.py

           import streamlit as st
           from pathlib import Path

           st.iframe("https://docs.streamlit.io", height=600)
           st.iframe("<p>Hello from inline HTML.</p>")
           st.iframe(Path("reports/summary.html"))

        """
        validate_width(width, allow_content=True)
        validate_height(height, allow_content=True)

        iframe_proto = IFrameProto()
        resolved_src, resolved_srcdoc = _resolve_iframe_source(self.dg, src)
        resolved_height = _resolve_iframe_height(
            height, is_srcdoc=resolved_srcdoc is not None
        )

        marshall(
            iframe_proto,
            src=resolved_src,
            srcdoc=resolved_srcdoc,
            scrolling=True,
            tab_index=tab_index,
        )
        layout_config = LayoutConfig(width=width, height=resolved_height)
        return self.dg._enqueue("iframe", iframe_proto, layout_config=layout_config)

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
            ``st.components.v1.iframe`` is deprecated and will be removed in a
            future release. Use ``st.iframe`` instead.

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
        show_deprecation_warning(_COMPONENTS_V1_IFRAME_DEPRECATION_WARNING)
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
            ``st.components.v1.html`` is deprecated and will be removed in a
            future release. Use ``st.iframe`` instead.

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
        show_deprecation_warning(_COMPONENTS_V1_IFRAME_DEPRECATION_WARNING)
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


def _resolve_iframe_source(
    dg: DeltaGenerator, src: str | Path
) -> tuple[str | None, str | None]:
    if isinstance(src, Path):
        return _resolve_iframe_file_source(dg, src)

    if _is_url_source(src):
        return src, None

    if _is_file_path(src):
        return _resolve_iframe_file_source(dg, Path(src))

    return None, src


def _resolve_iframe_file_source(
    dg: DeltaGenerator, file_path: Path
) -> tuple[str | None, str | None]:
    if _is_html_file(file_path):
        with file_path.open(encoding="utf-8") as file:
            return None, file.read()

    return _marshall_iframe_media_file(dg, file_path), None


def _marshall_iframe_media_file(dg: DeltaGenerator, file_path: Path) -> str:
    mimetype, _ = mimetypes.guess_type(str(file_path))
    if mimetype is None:
        mimetype = "application/octet-stream"

    coordinates = dg._get_delta_path_str()
    file_path_str = str(file_path)

    if runtime.exists():
        file_url = runtime.get_instance().media_file_mgr.add(
            file_path_str, mimetype, coordinates
        )
        caching.save_media_data(file_path_str, mimetype, coordinates)
        return file_url

    return ""


def _resolve_iframe_height(height: Height, *, is_srcdoc: bool) -> Height:
    if height == "content" and not is_srcdoc:
        return _CONTENT_HEIGHT_FALLBACK_PX

    return height


def _is_url_source(src: str) -> bool:
    return src.startswith(_URL_PREFIXES)


def _is_file_path(src: object) -> bool:
    try:
        return os.path.isfile(src)
    except TypeError:
        return False


def _is_html_file(file_path: Path) -> bool:
    return file_path.suffix.lower() in _HTML_FILE_EXTENSIONS
