from streamlit.proto.Text_pb2 import Text as TextProto
from .utils import _clean_text


class TextMixin:
    def text(dg, body):
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
        text_proto = TextProto()
        text_proto.body = _clean_text(body)
        return dg._enqueue("text", text_proto)  # type: ignore
