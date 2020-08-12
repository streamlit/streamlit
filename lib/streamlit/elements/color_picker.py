import re

from streamlit.proto.ColorPicker_pb2 import ColorPicker as ColorPickerProto
from streamlit.errors import StreamlitAPIException
from .utils import _get_widget_ui_value


class ColorPickerMixin:
    def beta_color_picker(dg, label, value=None, key=None):
        """Display a color picker widget.

        Note: This is a beta feature. See
        https://docs.streamlit.io/en/latest/pre_release_features.html for more
        information.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : str or None
            The hex value of this widget when it first renders. If None,
            defaults to black.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.

        Returns
        -------
        str
            The selected color as a hex string.

        Example
        -------
        >>> color = st.beta_color_picker('Pick A Color', '#00f900')
        >>> st.write('The current color is', color)

        """
        # set value default
        if value is None:
            value = "#000000"

        # make sure the value is a string
        if not isinstance(value, str):
            raise StreamlitAPIException(
                """
                Color Picker Value has invalid type: %s. Expects a hex string
                like '#00FFAA' or '#000'.
                """
                % type(value).__name__
            )

        # validate the value and expects a hex string
        match = re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", value)

        if not match:
            raise StreamlitAPIException(
                """
                '%s' is not a valid hex code for colors. Valid ones are like
                '#00FFAA' or '#000'.
                """
                % value
            )

        color_picker_proto = ColorPickerProto()
        color_picker_proto.label = label
        color_picker_proto.default = str(value)

        ui_value = _get_widget_ui_value(
            "color_picker", color_picker_proto, user_key=key
        )
        current_value = ui_value if ui_value is not None else value
        return dg._enqueue("color_picker", color_picker_proto, str(current_value))  # type: ignore
