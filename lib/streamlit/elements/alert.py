from streamlit.proto.Alert_pb2 import Alert as AlertProto
from .utils import _clean_text


class AlertMixin:
    def error(dg, body):
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
        return dg._enqueue("alert", alert_proto)  # type: ignore

    def warning(dg, body):
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
        return dg._enqueue("alert", alert_proto)  # type: ignore

    def info(dg, body):
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
        return dg._enqueue("alert", alert_proto)  # type: ignore

    def success(dg, body):
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
        return dg._enqueue("alert", alert_proto)  # type: ignore
