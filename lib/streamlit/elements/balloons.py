import random

from streamlit.proto import Balloons_pb2


class BalloonsMixin:
    def balloons(dg):
        """Draw celebratory balloons.

        Example
        -------
        >>> st.balloons()

        ...then watch your app and get ready for a celebration!

        """
        balloons_proto = Balloons_pb2.Balloons()

        balloons_proto.type = Balloons_pb2.Balloons.DEFAULT
        balloons_proto.execution_id = random.randrange(0xFFFFFFFF)

        dg._enqueue("balloons", balloons_proto)
