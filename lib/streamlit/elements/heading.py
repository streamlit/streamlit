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

from enum import Enum
from typing import TYPE_CHECKING, Literal, TypeAlias, cast

from streamlit.elements.lib.layout_utils import LayoutConfig, validate_width
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Heading_pb2 import Heading as HeadingProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.elements.lib.layout_utils import TextAlignment, Width
    from streamlit.type_util import SupportsStr


class HeadingProtoTag(Enum):
    TITLE_TAG = "h1"
    HEADER_TAG = "h2"
    SUBHEADER_TAG = "h3"


Anchor: TypeAlias = str | Literal[False] | None
Divider: TypeAlias = bool | str | None


class HeadingMixin:
    @gather_metrics("header")
    def header(
        self,
        body: SupportsStr,
        anchor: Anchor = None,
        *,  # keyword-only arguments:
        help: str | None = None,
        divider: Divider = False,
        width: Width = "stretch",
        text_alignment: TextAlignment = "left",
    ) -> DeltaGenerator:
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        anchor : str or False
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.
            If False, the anchor is not shown in the UI.

        help : str or None
            A tooltip that gets displayed next to the header. If this is
            ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        divider : bool, "blue", "green", "orange", "red", "violet", "yellow", "gray"/"grey", or "rainbow"
            Shows a colored divider below the header. If this is ``True``,
            successive headers will cycle through divider colors, except gray
            and rainbow. That is, the first header will have a blue line, the
            second header will have a green line, and so on. If this is a
            string, the color can be set to one of the following: blue, green,
            orange, red, violet, yellow, gray/grey, or rainbow.

        width : "stretch", "content", or int
            The width of the header element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        text_alignment : "left", "center", "right", or "justify"
            The horizontal alignment of the text within the element. This can
            be one of the following:

            - ``"left"`` (default): Text is aligned to the left edge.
            - ``"center"``: Text is centered.
            - ``"right"``: Text is aligned to the right edge.
            - ``"justify"``: Text is justified (stretched to fill the available
              width with the last line left-aligned).

            .. note::
                For text alignment to have a visible effect, the element's
                width must be wider than its content. If you use
                ``width="content"`` with short text, the alignment may not be
                noticeable.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.header("_Streamlit_ is :blue[cool] :sunglasses:")
        >>> st.header("This is a header with a divider", divider="gray")
        >>> st.header("These headers have rotating dividers", divider=True)
        >>> st.header("One", divider=True)
        >>> st.header("Two", divider=True)
        >>> st.header("Three", divider=True)
        >>> st.header("Four", divider=True)

        .. output::
           https://doc-header.streamlit.app/
           height: 600px

        """
        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

        return self.dg._enqueue(
            "heading",
            HeadingMixin._create_heading_proto(
                tag=HeadingProtoTag.HEADER_TAG,
                body=body,
                anchor=anchor,
                help=help,
                divider=divider,
            ),
            layout_config=layout_config,
        )

    @gather_metrics("subheader")
    def subheader(
        self,
        body: SupportsStr,
        anchor: Anchor = None,
        *,  # keyword-only arguments:
        help: str | None = None,
        divider: Divider = False,
        width: Width = "stretch",
        text_alignment: TextAlignment = "left",
    ) -> DeltaGenerator:
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        anchor : str or False
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.
            If False, the anchor is not shown in the UI.

        help : str or None
            A tooltip that gets displayed next to the subheader. If this is
            ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        divider : bool, "blue", "green", "orange", "red", "violet", "yellow", "gray"/"grey", or "rainbow"
            Shows a colored divider below the header. If this is ``True``,
            successive headers will cycle through divider colors, except gray
            and rainbow. That is, the first header will have a blue line, the
            second header will have a green line, and so on. If this is a
            string, the color can be set to one of the following: blue, green,
            orange, red, violet, yellow, gray/grey, or rainbow.

        width : "stretch", "content", or int
            The width of the subheader element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        text_alignment : "left", "center", "right", or "justify"
            The horizontal alignment of the text within the element. This can
            be one of the following:

            - ``"left"`` (default): Text is aligned to the left edge.
            - ``"center"``: Text is centered.
            - ``"right"``: Text is aligned to the right edge.
            - ``"justify"``: Text is justified (stretched to fill the available
              width with the last line left-aligned).

            .. note::
                For text alignment to have a visible effect, the element's
                width must be wider than its content. If you use
                ``width="content"`` with short text, the alignment may not be
                noticeable.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.subheader("_Streamlit_ is :blue[cool] :sunglasses:")
        >>> st.subheader("This is a subheader with a divider", divider="gray")
        >>> st.subheader("These subheaders have rotating dividers", divider=True)
        >>> st.subheader("One", divider=True)
        >>> st.subheader("Two", divider=True)
        >>> st.subheader("Three", divider=True)
        >>> st.subheader("Four", divider=True)

        .. output::
           https://doc-subheader.streamlit.app/
           height: 500px

        """
        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

        return self.dg._enqueue(
            "heading",
            HeadingMixin._create_heading_proto(
                tag=HeadingProtoTag.SUBHEADER_TAG,
                body=body,
                anchor=anchor,
                help=help,
                divider=divider,
            ),
            layout_config=layout_config,
        )

    @gather_metrics("title")
    def title(
        self,
        body: SupportsStr,
        anchor: Anchor = None,
        *,  # keyword-only arguments:
        help: str | None = None,
        width: Width = "stretch",
        text_alignment: TextAlignment = "left",
    ) -> DeltaGenerator:
        """Display text in title formatting.

        Each document should have a single `st.title()`, although this is not
        enforced.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        anchor : str or False
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.
            If False, the anchor is not shown in the UI.

        help : str or None
            A tooltip that gets displayed next to the title. If this is
            ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        width : "stretch", "content", or int
            The width of the title element. This can be one of the following:

            - ``"stretch"`` (default): The width of the element matches the
              width of the parent container.
            - ``"content"``: The width of the element matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The element has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the element matches the width
              of the parent container.

        text_alignment : "left", "center", "right", or "justify"
            The horizontal alignment of the text within the element. This can
            be one of the following:

            - ``"left"`` (default): Text is aligned to the left edge.
            - ``"center"``: Text is centered.
            - ``"right"``: Text is aligned to the right edge.
            - ``"justify"``: Text is justified (stretched to fill the available
              width with the last line left-aligned).

            .. note::
                For text alignment to have a visible effect, the element's
                width must be wider than its content. If you use
                ``width="content"`` with short text, the alignment may not be
                noticeable.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.title("This is a title")
        >>> st.title("_Streamlit_ is :blue[cool] :sunglasses:")

        .. output::
           https://doc-title.streamlit.app/
           height: 220px

        """
        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width, text_alignment=text_alignment)

        return self.dg._enqueue(
            "heading",
            HeadingMixin._create_heading_proto(
                tag=HeadingProtoTag.TITLE_TAG,
                body=body,
                anchor=anchor,
                help=help,
            ),
            layout_config=layout_config,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)

    @staticmethod
    def _handle_divider_color(divider: Divider) -> str:
        if divider is True:
            return "auto"
        valid_colors = [
            "red",
            "orange",
            "yellow",
            "blue",
            "green",
            "violet",
            "gray",
            "grey",
            "rainbow",
        ]
        if divider in valid_colors:
            return cast("str", divider)
        raise StreamlitAPIException(
            f"Divider parameter has invalid value: `{divider}`. Please choose from: {', '.join(valid_colors)}."
        )

    @staticmethod
    def _create_heading_proto(
        tag: HeadingProtoTag,
        body: SupportsStr,
        anchor: Anchor = None,
        help: str | None = None,
        divider: Divider = False,
    ) -> HeadingProto:
        proto = HeadingProto()
        proto.tag = tag.value
        proto.body = clean_text(body)
        if divider:
            proto.divider = HeadingMixin._handle_divider_color(divider)
        if anchor is not None:
            if anchor is False:
                proto.hide_anchor = True
            elif isinstance(anchor, str):
                proto.anchor = anchor
            elif anchor is True:  # type: ignore
                raise StreamlitAPIException(
                    f"Anchor parameter has invalid value: {anchor}. "
                    "Supported values: None, any string or False"
                )
            else:
                raise StreamlitAPIException(
                    f"Anchor parameter has invalid type: {type(anchor).__name__}. "
                    "Supported values: None, any string or False"
                )

        if help:
            proto.help = help

        return proto
