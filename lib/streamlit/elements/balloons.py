from typing import cast, TYPE_CHECKING

from streamlit.proto.Balloons_pb2 import Balloons as BalloonsProto
from streamlit.runtime.metrics_util import gather_metrics

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class BalloonsMixin:
    @gather_metrics
    def balloons(self) -> "DeltaGenerator":
        """Draw celebratory balloons.

        Example
        -------
        >>> st.balloons()

        ...then watch your app and get ready for a celebration!

        """
        balloons_proto = BalloonsProto()
        balloons_proto.show = True
        return self.dg._enqueue("balloons", balloons_proto)

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
