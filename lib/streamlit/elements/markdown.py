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

from typing import TYPE_CHECKING, Final, Literal, cast

from streamlit.elements.lib.layout_utils import (
    LayoutConfig,
    Width,
    WidthWithoutContent,
    validate_width,
)
from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text, validate_icon_or_emoji
from streamlit.type_util import SupportsStr, is_sympy_expression

if TYPE_CHECKING:
    import sympy

    from streamlit.delta_generator import DeltaGenerator

MARKDOWN_HORIZONTAL_RULE_EXPRESSION: Final = "---"


class MarkdownMixin:
    @gather_metrics("markdown")
    def markdown(
        self,
        body: SupportsStr,
        unsafe_allow_html: bool = False,
        *,  # keyword-only arguments:
        help: str | None = None,
    ) -> DeltaGenerator:
        r"""Display string formatted as Markdown.

        Parameters
        ----------
        body : any
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.
            If anything other than a string is passed, it will be converted
            into a string behind the scenes using ``str(body)``.

            This also supports:

            - Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            - Streamlit logo shortcode. Use ``:streamlit:`` to add a little
              Streamlit flair to your text.

            - A limited set of typographical symbols. ``"<- -> <-> -- >= <= ~="``
              becomes "← → ↔ — ≥ ≤ ≈" when parsed as Markdown.

            - Google Material Symbols (rounded style), using the syntax
              ``:material/icon_name:``, where "icon_name" is the name of the
              icon in snake case. For a complete list of icons, see Google's
              `Material Symbols <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

            - LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            - Colored text and background colors for text, using the syntax
              ``:color[text to be colored]`` and ``:color-background[text to be colored]``,
              respectively. ``color`` must be replaced with any of the following
              supported colors: blue, green, orange, red, violet, gray/grey,
              rainbow, or primary. For example, you can use
              ``:orange[your text here]`` or ``:blue-background[your text here]``.
              If you use "primary" for color, Streamlit will use the default
              primary accent color unless you set the ``theme.primaryColor``
              configuration option.

            - Colored badges, using the syntax ``:color-badge[text in the badge]``.
              ``color`` must be replaced with any of the following supported
              colors: blue, green, orange, red, violet, gray/grey, or primary.
              For example, you can use ``:orange-badge[your text here]`` or
              ``:blue-badge[your text here]``.

            - Small text, using the syntax ``:small[text to show small]``.


        unsafe_allow_html : bool
            Whether to render HTML within ``body``. If this is ``False``
            (default), any HTML tags found in ``body`` will be escaped and
            therefore treated as raw text. If this is ``True``, any HTML
            expressions within ``body`` will be rendered.

            Adding custom HTML to your app impacts safety, styling, and
            maintainability.

            .. note::
                If you only want to insert HTML or CSS without Markdown text,
                we recommend using ``st.html`` instead.

        help : str or None
            A tooltip that gets displayed next to the Markdown. If this is
            ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.markdown("*Streamlit* is **really** ***cool***.")
        >>> st.markdown('''
        ...     :red[Streamlit] :orange[can] :green[write] :blue[text] :violet[in]
        ...     :gray[pretty] :rainbow[colors] and :blue-background[highlight] text.''')
        >>> st.markdown("Here's a bouquet &mdash;\
        ...             :tulip::cherry_blossom::rose::hibiscus::sunflower::blossom:")
        >>>
        >>> multi = '''If you end a line with two spaces,
        ... a soft return is used for the next line.
        ...
        ... Two (or more) newline characters in a row will result in a hard return.
        ... '''
        >>> st.markdown(multi)

        .. output::
           https://doc-markdown.streamlit.app/
           height: 350px

        """
        markdown_proto = MarkdownProto()

        markdown_proto.body = clean_text(body)
        markdown_proto.allow_html = unsafe_allow_html
        markdown_proto.element_type = MarkdownProto.Type.NATIVE
        if help:
            markdown_proto.help = help

        return self.dg._enqueue("markdown", markdown_proto)

    @gather_metrics("caption")
    def caption(
        self,
        body: SupportsStr,
        unsafe_allow_html: bool = False,
        *,  # keyword-only arguments:
        help: str | None = None,
    ) -> DeltaGenerator:
        """Display text in small font.

        This should be used for captions, asides, footnotes, sidenotes, and
        other explanatory text.

        Parameters
        ----------
        body : str
            The text to display as GitHub-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        unsafe_allow_html : bool
            Whether to render HTML within ``body``. If this is ``False``
            (default), any HTML tags found in ``body`` will be escaped and
            therefore treated as raw text. If this is ``True``, any HTML
            expressions within ``body`` will be rendered.

            Adding custom HTML to your app impacts safety, styling, and
            maintainability.

            .. note::
                If you only want to insert HTML or CSS without Markdown text,
                we recommend using ``st.html`` instead.

        help : str or None
            A tooltip that gets displayed next to the caption. If this is
            ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.caption("This is a string that explains something above.")
        >>> st.caption("A caption with _italics_ :blue[colors] and emojis :sunglasses:")

        """
        caption_proto = MarkdownProto()
        caption_proto.body = clean_text(body)
        caption_proto.allow_html = unsafe_allow_html
        caption_proto.is_caption = True
        caption_proto.element_type = MarkdownProto.Type.CAPTION
        if help:
            caption_proto.help = help
        return self.dg._enqueue("markdown", caption_proto)

    @gather_metrics("latex")
    def latex(
        self,
        body: SupportsStr | sympy.Expr,
        *,  # keyword-only arguments:
        help: str | None = None,
        width: Width = "stretch",
    ) -> DeltaGenerator:
        # This docstring needs to be "raw" because of the backslashes in the
        # example below.
        r"""Display mathematical expressions formatted as LaTeX.

        Supported LaTeX functions are listed at
        https://katex.org/docs/supported.html.

        Parameters
        ----------
        body : str or SymPy expression
            The string or SymPy expression to display as LaTeX. If str, it's
            a good idea to use raw Python strings since LaTeX uses backslashes
            a lot.

        help : str or None
            A tooltip that gets displayed next to the LaTeX expression. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.

        width : int or "stretch" or "content"
            The width of the LaTeX expression. If "stretch" (default), the
            expression will take up the full width of the container. If "content",
            the expression will take up only as much width as needed. If an integer,
            the width will be set to that number of pixels.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.latex(r'''
        ...     a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
        ...     \sum_{k=0}^{n-1} ar^k =
        ...     a \left(\frac{1-r^{n}}{1-r}\right)
        ...     ''')

        """

        if is_sympy_expression(body):
            import sympy

            body = sympy.latex(body)

        latex_proto = MarkdownProto()
        latex_proto.body = f"$$\n{clean_text(body)}\n$$"
        latex_proto.element_type = MarkdownProto.Type.LATEX
        if help:
            latex_proto.help = help

        validate_width(width, allow_content=True)
        layout_config = LayoutConfig(width=width)

        return self.dg._enqueue("markdown", latex_proto, layout_config=layout_config)

    @gather_metrics("divider")
    def divider(self, *, width: WidthWithoutContent = "stretch") -> DeltaGenerator:
        """Display a horizontal rule.

        Parameters
        ----------
        width : int or "stretch"
            The width of the divider. If "stretch" (default), the divider will
            take up the full width of the container. If an integer, the width
            will be set to that number of pixels.

        .. note::
            You can achieve the same effect with st.write("---") or
            even just "---" in your script (via magic).

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> st.divider()

        """

        divider_proto = MarkdownProto()
        divider_proto.body = MARKDOWN_HORIZONTAL_RULE_EXPRESSION
        divider_proto.element_type = MarkdownProto.Type.DIVIDER

        validate_width(width, allow_content=False)
        layout_config = LayoutConfig(width=width)

        return self.dg._enqueue("markdown", divider_proto, layout_config=layout_config)

    @gather_metrics("badge")
    def badge(
        self,
        label: str,
        *,  # keyword-only arguments:
        icon: str | None = None,
        color: Literal[
            "blue",
            "green",
            "orange",
            "red",
            "violet",
            "gray",
            "grey",
            "primary",
        ] = "blue",
    ) -> DeltaGenerator:
        """Display a colored badge with an icon and label.

        This is a thin wrapper around the color-badge Markdown directive.
        The following are equivalent:

        - ``st.markdown(":blue-badge[Home]")``
        - ``st.badge("Home", color="blue")``

        .. note::
            You can insert badges everywhere Streamlit supports Markdown by
            using the color-badge Markdown directive. See ``st.markdown`` for
            more information.

        Parameters
        ----------
        label : str
            The label to display in the badge. The label can optionally contain
            GitHub-flavored Markdown of the following types: Bold, Italics,
            Strikethroughs, Inline Code.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives. Because this command escapes square
            brackets (``[ ]``) in this parameter, any directive requiring
            square brackets is not supported.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown

        icon : str or None
            An optional emoji or icon to display next to the badge label. If
            ``icon`` is ``None`` (default), no icon is displayed. If ``icon``
            is a string, the following options are valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols \
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.

        color : str
            The color to use for the badge. This defaults to ``"blue"``.

            This can be one of the following supported colors: blue, green,
            orange, red, violet, gray/grey, or primary. If you use
            ``"primary"``, Streamlit will use the default primary accent color
            unless you set the ``theme.primaryColor`` configuration option.

        Examples
        --------
        Create standalone badges with ``st.badge`` (with or without icons). If
        you want to have multiple, side-by-side badges, you can use the
        Markdown directive in ``st.markdown``.

        >>> import streamlit as st
        >>>
        >>> st.badge("New")
        >>> st.badge("Success", icon=":material/check:", color="green")
        >>>
        >>> st.markdown(
        >>>     ":violet-badge[:material/star: Favorite] :orange-badge[⚠️ Needs review] :gray-badge[Deprecated]"
        >>> )

        .. output ::
            https://doc-badge.streamlit.app/
            height: 220px

        """
        icon_str = validate_icon_or_emoji(icon) + " " if icon is not None else ""

        # Escape [ and ] characters in the label to prevent breaking the directive syntax
        escaped_label = label.replace("[", "\\[").replace("]", "\\]")

        badge_proto = MarkdownProto()
        badge_proto.body = f":{color}-badge[{icon_str}{escaped_label}]"
        badge_proto.element_type = MarkdownProto.Type.NATIVE
        return self.dg._enqueue("markdown", badge_proto)

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
