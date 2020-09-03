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
        dg = dg._active_dg  # type: ignore
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.ERROR
        return dg._enqueue("alert", alert_proto)

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
        dg = dg._active_dg  # type: ignore
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.WARNING
        return dg._enqueue("alert", alert_proto)

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
        dg = dg._active_dg  # type: ignore
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.INFO
        return dg._enqueue("alert", alert_proto)

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
        dg = dg._active_dg  # type: ignore
        alert_proto = AlertProto()
        alert_proto.body = _clean_text(body)
        alert_proto.format = AlertProto.SUCCESS
        return dg._enqueue("alert", alert_proto)
