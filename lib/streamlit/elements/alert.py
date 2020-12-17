from typing import cast

import streamlit
from streamlit.proto.Alert_pb2 import Alert as AlertProto
from .utils import _clean_text


class AlertMixin:
    def error(self, body):
        """Display error message.

        Parameters
        ----------
        body : str
            The error text to display.

        Example
        -------
        >>> st.error('This is an error')

        """
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.ERROR
        return self.dg._enqueue("alert", alert_proto)

    def warning(self, body):
        """Display warning message.

        Parameters
        ----------
        body : str
            The warning text to display.

        Example
        -------
        >>> st.warning('This is a warning')

        """
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.WARNING
        return self.dg._enqueue("alert", alert_proto)

    def info(self, body):
        """Display an informational message.

        Parameters
        ----------
        body : str
            The info text to display.

        Example
        -------
        >>> st.info('This is a purely informational message')

        """
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.INFO
        return self.dg._enqueue("alert", alert_proto)

    def success(self, body):
        """Display a success message.

        Parameters
        ----------
        body : str
            The success text to display.

        Example
        -------
        >>> st.success('This is a success message!')

        """
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.SUCCESS
        return self.dg._enqueue("alert", alert_proto)

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
