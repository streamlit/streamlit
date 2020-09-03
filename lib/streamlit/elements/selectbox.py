from streamlit.proto.Selectbox_pb2 import Selectbox as SelectboxProto
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import ensure_iterable
from .utils import _get_widget_ui_value, NoValue


class SelectboxMixin:
    def selectbox(dg, label, options, index=0, format_func=str, key=None):
        """Display a select widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this select widget is for.
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the select options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of the labels. It receives the option
            as an argument and its output will be cast to str.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        any
            The selected option

        Example
        -------
        >>> option = st.selectbox(
        ...     'How would you like to be contacted?',
        ...     ('Email', 'Home phone', 'Mobile phone'))
        >>>
        >>> st.write('You selected:', option)

        """
        options = ensure_iterable(options)

        if not isinstance(index, int):
            raise StreamlitAPIException(
                "Selectbox Value has invalid type: %s" % type(index).__name__
            )

        if len(options) > 0 and not 0 <= index < len(options):
            raise StreamlitAPIException(
                "Selectbox index must be between 0 and length of options"
            )

        selectbox_proto = SelectboxProto()
        selectbox_proto.label = label
        selectbox_proto.default = index
        selectbox_proto.options[:] = [str(format_func(option)) for option in options]

        ui_value = _get_widget_ui_value("selectbox", selectbox_proto, user_key=key)
        current_value = ui_value if ui_value is not None else index

        return_value = (
            options[current_value]
            if len(options) > 0 and options[current_value] is not None
            else NoValue
        )
        return dg._enqueue("selectbox", selectbox_proto, return_value)  # type: ignore
