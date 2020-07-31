import random

from streamlit.proto.Balloons_pb2 import Balloons as BalloonsProto


class BalloonsMixin:
    def balloons(dg):
        """Draw celebratory balloons.

        Example
        -------
        >>> st.balloons()

        ...then watch your app and get ready for a celebration!

        """
        balloons_proto = BalloonsProto()

        balloons_proto.type = BalloonsProto.DEFAULT
        balloons_proto.execution_id = random.randrange(0xFFFFFFFF)

        return dg._enqueue("balloons", balloons_proto)  # type: ignore
