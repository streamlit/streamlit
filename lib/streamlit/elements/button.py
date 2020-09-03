from streamlit.proto.Button_pb2 import Button as ButtonProto
from .utils import _get_widget_ui_value


class ButtonMixin:
    def button(dg, label, key=None):
        """Display a button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        bool
            If the button was clicked on the last run of the app.

        Example
        -------
        >>> if st.button('Say hello'):
        ...     st.write('Why hello there')
        ... else:
        ...     st.write('Goodbye')

        """
        button_proto = ButtonProto()

        button_proto.label = label
        button_proto.default = False

        ui_value = _get_widget_ui_value("button", button_proto, user_key=key)
        current_value = ui_value if ui_value is not None else False

        return dg._enqueue("button", button_proto, current_value)  # type: ignore
