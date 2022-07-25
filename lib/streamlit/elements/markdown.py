# Copyright 2018-2022 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import cast, Optional, TYPE_CHECKING, Union

from streamlit import type_util
from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
from .utils import clean_text

if TYPE_CHECKING:
    import sympy

    from streamlit.delta_generator import DeltaGenerator


class MarkdownMixin:
    def markdown(self, body: str, unsafe_allow_html: bool = False) -> "DeltaGenerator":
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

        unsafe_allow_html : bool
            By default, any HTML tags found in the body will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, we *strongly advise against it*. It is hard to write
            secure HTML, so by using this argument you may be compromising your
            users' security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

            *Also note that ``unsafe_allow_html`` is a temporary measure and may
            be removed from Streamlit at any time.*

            If you decide to turn on HTML anyway, we ask you to please tell us
            your exact use case here:

            https://discuss.streamlit.io/t/96

            This will help us come up with safe APIs that allow you to do what
            you want.

        Example
        -------
        >>> st.markdown('Streamlit is **_really_ cool**.')

        """
        markdown_proto = MarkdownProto()

        markdown_proto.body = clean_text(body)
        markdown_proto.allow_html = unsafe_allow_html

        return self.dg._enqueue("markdown", markdown_proto)

    def header(self, body: str, anchor: Optional[str] = None) -> "DeltaGenerator":
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display.

        anchor : str
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.

        Example
        -------
        >>> st.header('This is a header')

        """
        header_proto = MarkdownProto()
        if anchor is None:
            header_proto.body = f"## {clean_text(body)}"
        else:
            header_proto.body = f'<h2 data-anchor="{anchor}">{clean_text(body)}</h2>'
            header_proto.allow_html = True
        return self.dg._enqueue("markdown", header_proto)

    def subheader(self, body: str, anchor: Optional[str] = None) -> "DeltaGenerator":
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display.

        anchor : str
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.

        Example
        -------
        >>> st.subheader('This is a subheader')

        """
        subheader_proto = MarkdownProto()
        if anchor is None:
            subheader_proto.body = f"### {clean_text(body)}"
        else:
            subheader_proto.body = f'<h3 data-anchor="{anchor}">{clean_text(body)}</h3>'
            subheader_proto.allow_html = True

        return self.dg._enqueue("markdown", subheader_proto)

    def code(self, body: str, language: Optional[str] = "python") -> "DeltaGenerator":
        """Display a code block with optional syntax highlighting.

        (This is a convenience wrapper around `st.markdown()`)

        Parameters
        ----------
        body : str
            The string to display as code.

        language : str
            The language that the code is written in, for syntax highlighting.
            If omitted, the code will be unstyled.

            For a list of available ``language`` imports, see:

            https://github.com/react-syntax-highlighter/react-syntax-highlighter/blob/master/AVAILABLE_LANGUAGES_PRISM.MD

        Example
        -------
        >>> code = '''def hello():
        ...     print("Hello, Streamlit!")'''
        >>> st.code(code, language='python')

        """
        code_proto = MarkdownProto()
        markdown = "```%(language)s\n%(body)s\n```" % {
            "language": language or "",
            "body": body,
        }
        code_proto.body = clean_text(markdown)
        return self.dg._enqueue("markdown", code_proto)

    def title(self, body: str, anchor: Optional[str] = None) -> "DeltaGenerator":
        """Display text in title formatting.

        Each document should have a single `st.title()`, although this is not
        enforced.

        Parameters
        ----------
        body : str
            The text to display.

        anchor : str
            The anchor name of the header that can be accessed with #anchor
            in the URL. If omitted, it generates an anchor using the body.

        Example
        -------
        >>> st.title('This is a title')

        """
        title_proto = MarkdownProto()
        if anchor is None:
            title_proto.body = f"# {clean_text(body)}"
        else:
            title_proto.body = f'<h1 data-anchor="{anchor}">{clean_text(body)}</h1>'
            title_proto.allow_html = True
        return self.dg._enqueue("markdown", title_proto)

    def caption(self, body: str, unsafe_allow_html: bool = False) -> "DeltaGenerator":
        """Display text in small font.

        This should be used for captions, asides, footnotes, sidenotes, and
        other explanatory text.

        Parameters
        ----------
        body : str
            The text to display.

        unsafe_allow_html : bool
            By default, any HTML tags found in strings will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, *we strongly advise against it*. It is hard to write secure
            HTML, so by using this argument you may be compromising your users'
            security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

            **Also note that `unsafe_allow_html` is a temporary measure and may be
            removed from Streamlit at any time.**

            If you decide to turn on HTML anyway, we ask you to please tell us your
            exact use case here:
            https://discuss.streamlit.io/t/96 .

            This will help us come up with safe APIs that allow you to do what you
            want.

        Example
        -------
        >>> st.caption('This is a string that explains something above.')

        """
        caption_proto = MarkdownProto()
        caption_proto.body = clean_text(body)
        caption_proto.allow_html = unsafe_allow_html
        caption_proto.is_caption = True
        return self.dg._enqueue("markdown", caption_proto)

    def latex(self, body: Union[str, "sympy.Expr"]) -> "DeltaGenerator":
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
        >>> st.latex(r'''
        ...     a + ar + a r^2 + a r^3 + \cdots + a r^{n-1} =
        ...     \sum_{k=0}^{n-1} ar^k =
        ...     a \left(\frac{1-r^{n}}{1-r}\right)
        ...     ''')

        """
        if type_util.is_sympy_expession(body):
            import sympy

            body = sympy.latex(body)

        latex_proto = MarkdownProto()
        latex_proto.body = "$$\n%s\n$$" % clean_text(body)
        return self.dg._enqueue("markdown", latex_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
