# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

from typing import TYPE_CHECKING, cast

from streamlit.elements.lib.layout_utils import LayoutConfig
from streamlit.errors import StreamlitAPIException
from streamlit.proto.IFrame_pb2 import IFrame as IFrameProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


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

        Example
        -------

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

        Example
        -------

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
