from streamlit.proto.Radio_pb2 import Radio as RadioProto
from streamlit.errors import StreamlitAPIException
from streamlit.type_util import ensure_iterable
from .utils import _get_widget_ui_value, NoValue


class RadioMixin:
    def radio(dg, label, options, index=0, format_func=str, key=None):
        """Display a radio button widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this radio group is for.
        options : list, tuple, numpy.ndarray, pandas.Series, or pandas.DataFrame
            Labels for the radio options. This will be cast to str internally
            by default. For pandas.DataFrame, the first column is selected.
        index : int
            The index of the preselected option on first render.
        format_func : function
            Function to modify the display of radio options. It receives
            the raw option as an argument and should output the label to be
            shown for that option. This has no impact on the return value of
            the radio.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        any
            The selected option.

        Example
        -------
        >>> genre = st.radio(
        ...     "What\'s your favorite movie genre",
        ...     ('Comedy', 'Drama', 'Documentary'))
        >>>
        >>> if genre == 'Comedy':
        ...     st.write('You selected comedy.')
        ... else:
        ...     st.write("You didn\'t select comedy.")

        """
        options = ensure_iterable(options)

        if not isinstance(index, int):
            raise StreamlitAPIException(
                "Radio Value has invalid type: %s" % type(index).__name__
            )

        if len(options) > 0 and not 0 <= index < len(options):
            raise StreamlitAPIException(
                "Radio index must be between 0 and length of options"
            )

        radio_proto = RadioProto()
        radio_proto.label = label
        radio_proto.default = index
        radio_proto.options[:] = [str(format_func(option)) for option in options]

        ui_value = _get_widget_ui_value("radio", radio_proto, user_key=key)
        current_value = ui_value if ui_value is not None else index

        return_value = (
            options[current_value]
            if len(options) > 0 and options[current_value] is not None
            else NoValue
        )
        return dg._enqueue("radio", radio_proto, return_value)  # type: ignore
