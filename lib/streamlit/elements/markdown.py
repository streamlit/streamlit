from streamlit.proto.Markdown_pb2 import Markdown as MarkdownProto
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
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=PXz9xgY8aB88eziDVEZLyS
           height: 50px

        """
        markdown_proto = MarkdownProto()

        markdown_proto.body = _clean_text(body)
        markdown_proto.allow_html = unsafe_allow_html

        return dg._enqueue("markdown", markdown_proto)  # type: ignore

    def header(dg, body):
        """Display text in header formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.header('This is a header')

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=AnfQVFgSCQtGv6yMUMUYjj
           height: 100px

        """
        header_proto = MarkdownProto()
        header_proto.body = "## %s" % _clean_text(body)
        return dg._enqueue("markdown", header_proto)  # type: ignore

    def subheader(dg, body):
        """Display text in subheader formatting.

        Parameters
        ----------
        body : str
            The text to display.

        Example
        -------
        >>> st.subheader('This is a subheader')

        .. output::
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=LBKJTfFUwudrbWENSHV6cJ
           height: 100px

        """
        subheader_proto = MarkdownProto()
        subheader_proto.body = "### %s" % _clean_text(body)
        return dg._enqueue("markdown", subheader_proto)  # type: ignore

    def code(dg, body, language="python"):
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
           https://static.streamlit.io/0.27.0-kBtt/index.html?id=VDRnaCEZWSBCNUd5gNQZv2
           height: 100px

        """
        code_proto = MarkdownProto()
        markdown = "```%(language)s\n%(body)s\n```" % {
            "language": language or "",
            "body": body,
        }
        code_proto.body = _clean_text(markdown)
        return dg._enqueue("markdown", code_proto)  # type: ignore

    def title(dg, body):
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
           https://static.streamlit.io/0.25.0-2JkNY/index.html?id=SFcBGANWd8kWXF28XnaEZj
           height: 100px

        """
        title_proto = MarkdownProto()
        title_proto.body = "# %s" % _clean_text(body)
        return dg._enqueue("markdown", title_proto)  # type: ignore

    def latex(dg, body):
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
           https://static.streamlit.io/0.50.0-td2L/index.html?id=NJFsy6NbGTsH2RF9W6ioQ4
           height: 75px

        """
        if type_util.is_sympy_expession(body):
            import sympy

            body = sympy.latex(body)

        latex_proto = MarkdownProto()
        latex_proto.body = "$$\n%s\n$$" % _clean_text(body)
        return dg._enqueue("markdown", latex_proto)  # type: ignore
