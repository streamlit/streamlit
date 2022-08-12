from typing import cast, TYPE_CHECKING

from streamlit.proto.Text_pb2 import Text as TextProto
from streamlit.string_util import clean_text
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


class TextMixin:
    @gather_metrics
    def text(self, body: "SupportsStr") -> "DeltaGenerator":
        """Write fixed-width and preformatted text.

        Parameters
        ----------
        body : str
            The string to display.

        Example
        -------
        >>> st.text('This is some text.')

        """
        text_proto = TextProto()
        text_proto.body = clean_text(body)
        return self.dg._enqueue("text", text_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
