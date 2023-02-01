# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
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

from typing import TYPE_CHECKING, Optional, Union, cast

from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.string_util import clean_text
from streamlit.type_util import SupportsStr, is_sympy_expession

if TYPE_CHECKING:
    import sympy

    from streamlit.delta_generator import DeltaGenerator


class MarkdownMixin:
    @gather_metrics("markdown")
    def markdown(
        self, body: SupportsStr, unsafe_allow_html: bool = False
    ) -> "DeltaGenerator":
        """Display string formatted as Markdown.

        Parameters
        ----------
        body : str
            The string to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text, using the syntax ``:color[text to be colored]``,
              where ``color`` needs to be replaced with any of the following
              supported colors: blue, green, orange, red, violet.

        unsafe_allow_html : bool
            By default, any HTML tags found in the body will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, we *strongly advise against it*. It is hard to write
            secure HTML, so by using this argument you may be compromising your
            users' security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.markdown('Streamlit is **_really_ cool**.')
        >>> st.markdown(”This text is :red[colored red], and this is **:blue[colored]** and bold.”)
        >>> st.markdown(":green[$\sqrt{x^2+y^2}=1$] is a Pythagorean identity. :pencil:")

        """
        markdown_proto = MarkdownProto()

        markdown_proto.body = clean_text(body)
        markdown_proto.allow_html = unsafe_allow_html
        markdown_proto.element_type = MarkdownProto.Type.NATIVE

        return self.dg._enqueue("markdown", markdown_proto)

    @gather_metrics("code")
    def code(
        self,
        body: SupportsStr,
        language: Optional[str] = "python",
        line_numbers: bool = False,
    ) -> "DeltaGenerator":
        """Display a code block with optional syntax highlighting.

        (This is a convenience wrapper around `st.markdown()`)

        Parameters
        ----------
        body : str
            The string to display as code.

        language : str or None
            The language that the code is written in, for syntax highlighting.
            If ``None``, the code will be unstyled. Defaults to ``"python"``.

            For a list of available ``language`` values, see:

            https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_PRISM.MD

        line_numbers : bool
            Whether line numbers should be shown to the left of the code.
            Defaults to False.

        Example
        -------
        >>> import streamlit as st
        >>>
        >>> code = '''def hello():
        ...     print("Hello, Streamlit!")'''
        >>> st.code(code, language='python')

        """
        code_proto = MarkdownProto()
        metadata = " showLineNumbers" if line_numbers else ""
        markdown = f'```{language or "plaintext"}{metadata}\n{body}\n```'
        code_proto.body = clean_text(markdown)
        code_proto.element_type = MarkdownProto.Type.CODE
        return self.dg._enqueue("markdown", code_proto)

    @gather_metrics("caption")
    def caption(
        self, body: SupportsStr, unsafe_allow_html: bool = False
    ) -> "DeltaGenerator":
        """Display text in small font.

        This should be used for captions, asides, footnotes, sidenotes, and
        other explanatory text.

        Parameters
        ----------
        body : str
            The text to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as ``:+1:``  and ``:sunglasses:``.
              For a list of all supported codes,
              see https://share.streamlit.io/streamlit/emoji-shortcodes.

            * LaTeX expressions, by wrapping them in "$" or "$$" (the "$$"
              must be on their own lines). Supported LaTeX functions are listed
              at https://katex.org/docs/supported.html.

            * Colored text, using the syntax ``:color[text to be colored]``,
              where ``color`` needs to be replaced with any of the following
              supported colors: blue, green, orange, red, violet.

        unsafe_allow_html : bool
            By default, any HTML tags found in strings will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, *we strongly advise against it*. It is hard to write secure
            HTML, so by using this argument you may be compromising your users'
            security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

        Examples
        --------
        >>> import streamlit as st
        >>>
        >>> st.caption('This is a string that explains something above.')
        >>> st.caption('A caption with _italics_ :blue[colors] and emojis :sunglasses:')

        """
        caption_proto = MarkdownProto()
        caption_proto.body = clean_text(body)
        caption_proto.allow_html = unsafe_allow_html
        caption_proto.is_caption = True
        caption_proto.element_type = MarkdownProto.Type.CAPTION
        return self.dg._enqueue("markdown", caption_proto)

    @gather_metrics("latex")
    def latex(self, body: Union[SupportsStr, "sympy.Expr"]) -> "DeltaGenerator":
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
        if is_sympy_expession(body):
            import sympy

            body = sympy.latex(body)

        latex_proto = MarkdownProto()
        latex_proto.body = "$$\n%s\n$$" % clean_text(body)
        latex_proto.element_type = MarkdownProto.Type.LATEX
        return self.dg._enqueue("markdown", latex_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
