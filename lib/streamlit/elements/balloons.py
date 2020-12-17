from typing import cast

import streamlit
from streamlit.proto.Balloons_pb2 import Balloons as BalloonsProto


class BalloonsMixin:
    def balloons(self):
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
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
