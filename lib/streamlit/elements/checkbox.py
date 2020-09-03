from streamlit.proto.Checkbox_pb2 import Checkbox as CheckboxProto
from .utils import _get_widget_ui_value


class CheckboxMixin:
    def checkbox(dg, label, value=False, key=None):
        """Display a checkbox widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this checkbox is for.
        value : bool
            Preselect the checkbox when it first renders. This will be
            cast to bool internally.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        bool
            Whether or not the checkbox is checked.

        Example
        -------
        >>> agree = st.checkbox('I agree')
        >>>
        >>> if agree:
        ...     st.write('Great!')

        """
        checkbox_proto = CheckboxProto()
        checkbox_proto.label = label
        checkbox_proto.default = bool(value)

        ui_value = _get_widget_ui_value("checkbox", checkbox_proto, user_key=key)
        current_value = ui_value if ui_value is not None else value
        return dg._enqueue("checkbox", checkbox_proto, bool(current_value))  # type: ignore
