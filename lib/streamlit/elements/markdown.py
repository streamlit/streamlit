import json

from streamlit.proto import Markdown_pb2
from streamlit import type_util
from .utils import _clean_text


class MarkdownMixin:
    def markdown(dg, body, unsafe_allow_html=False):
        """Display string formatted as Markdown.

        Parameters
        ----------
        body : str
            The string to display as Github-flavored Markdown. Syntax
            information can be found at: https://github.github.com/gfm.

            This also supports:

            * Emoji shortcodes, such as `:+1:`  and `:sunglasses:`.
              For a list of all supported codes,
              see https://raw.githubusercontent.com/omnidan/node-emoji/master/lib/emoji.json.

            * LaTeX expressions, by just wrapping them in "$" or "$$" (the "$$"
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

            *Also note that `unsafe_allow_html` is a temporary measure and may
            be removed from Streamlit at any time.*

            If you decide to turn on HTML anyway, we ask you to please tell us
            your exact use case here:

            https://discuss.streamlit.io/t/96

            This will help us come up with safe APIs that allow you to do what
            you want.

        Example
        -------
        >>> st.markdown('Streamlit is **_really_ cool**.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PXz9xgY8aB88eziDVEZLyS
           height: 50px

        """
        markdown_proto = Markdown_pb2.Markdown()

        markdown_proto.body = clean_text(body)
        markdown_proto.allow_html = unsafe_allow_html

        return dg._enqueue("markdown", markdown_proto)


class HeaderMixin:
    def header(dg, element, body):
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.header('This is a header')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=AnfQVFgSCQtGv6yMUMUYjj
           height: 100px

        """
        header_proto = Markdown_pb2()
        header_proto.body = "## %s" % _clean_text(body)
        dg._enqueue("header", header_proto)


class SubheaderMixin:
    def subheader(dg, element, body):
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.subheader('This is a subheader')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=LBKJTfFUwudrbWENSHV6cJ
           height: 100px

        """
        subheader_proto = Markdown_pb2()
        subheader_proto.body = "### %s" % _clean_text(body)
        dg._enqueue("subheader", subheader_proto)


class CodeMixin:
    def code(dg, element, body, language="python"):
        """Display a code block with optional syntax highlighting.

        (This is a convenience wrapper around `st.markdown()`)

        Parameters
        ----------
        body : str
            The string to display as code.

        language : str
            The language that the code is written in, for syntax highlighting.
            If omitted, the code will be unstyled.

        Example
        -------
        >>> code = '''def hello():
        ...     print("Hello, Streamlit!")'''
        >>> st.code(code, language='python')

        .. output::
           https://share.streamlit.io/0.27.0-kBtt/index.html?id=VDRnaCEZWSBCNUd5gNQZv2
           height: 100px

        """
        code_proto = Markdown_pb2()
        markdown = "```%(language)s\n%(body)s\n```" % {
            "language": language or "",
            "body": body,
        }
        code_proto.body = _clean_text(markdown)
        dg._enqueue("code", code_proto)


class TitleMixin:
    def title(dg, element, body):
        """Display text in title formatting.

        Each document should have a single `st.title()`, although this is not
        enforced.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.title('This is a title')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=SFcBGANWd8kWXF28XnaEZj
           height: 100px

        """
        title_proto = Markdown_pb2()
        title_proto.body = "# %s" % _clean_text(body)
        dg._enqueue("title", title_proto)


class LatexMixin:
    def latex(dg, element, body):
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

        .. output::
           https://share.streamlit.io/0.50.0-td2L/index.html?id=NJFsy6NbGTsH2RF9W6ioQ4
           height: 75px

        """
        if type_util.is_sympy_expession(body):
            import sympy

            body = sympy.latex(body)

        latex_proto = Markdown_pb2()
        latex_proto.body = "$$\n%s\n$$" % _clean_text(body)
        dg._enqueue("latex", latex_proto)


class TextMixin:
    def text(dg, element, body):
        """Write fixed-width and preformatted text.

        Parameters
        ----------
        body : str
            The string to display.

        Example
        -------
        >>> st.text('This is some text.')

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=PYxU1kee5ubuhGR11NsnT1
           height: 50px

        """
        text_proto = Text_pb2()
        text_proto.body = _clean_text(body)
        dg._enqueue("text", text_proto)


class JsonMixin:
    def json(dg, element, body):
        """Display object or string as a pretty-printed JSON string.

        Parameters
        ----------
        body : Object or str
            The object to print as JSON. All referenced objects should be
            serializable to JSON as well. If object is a string, we assume it
            contains serialized JSON.

        Example
        -------
        >>> st.json({
        ...     'foo': 'bar',
        ...     'baz': 'boz',
        ...     'stuff': [
        ...         'stuff 1',
        ...         'stuff 2',
        ...         'stuff 3',
        ...         'stuff 5',
        ...     ],
        ... })

        .. output::
           https://share.streamlit.io/0.25.0-2JkNY/index.html?id=CTFkMQd89hw3yZbZ4AUymS
           height: 280px

        """
        import streamlit as st

        if not isinstance(body, str):
            try:
                body = json.dumps(body, default=lambda o: str(type(o)))
            except TypeError as err:
                st.warning(
                    "Warning: this data structure was not fully serializable as "
                    "JSON due to one or more unexpected keys.  (Error was: %s)" % err
                )
                body = json.dumps(body, skipkeys=True, default=lambda o: str(type(o)))

        json_proto = Markdown_pb2()
        json_proto.body = body
        dg._enqueue("json", json_proto)
