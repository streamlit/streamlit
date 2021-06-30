# Copyright 2018-2021 Streamlit Inc.
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#    http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

from typing import cast

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto.TextArea_pb2 import TextArea as TextAreaProto
from streamlit.proto.TextInput_pb2 import TextInput as TextInputProto
from streamlit.state.widgets import register_widget
from .form import current_form_id
from .utils import check_callback_rules, check_session_state_rules


class TextWidgetsMixin:
    def text_input(
        self,
        label,
        value="",
        max_chars=None,
        key=None,
        type="default",
        help=None,
        autocomplete=None,
        on_change=None,
        args=None,
        kwargs=None,
    ):
        """Display a single-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : any
            The text value of this widget when it first renders. This will be
            cast to str internally.
        max_chars : int or None
            Max number of characters allowed in text input.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        type : str
            The type of the text input. This can be either "default" (for
            a regular text input), or "password" (for a text input that
            masks the user's typed value). Defaults to "default".
        help : str
            An optional tooltip that gets displayed next to the input.
        autocomplete : str
            An optional value that will be passed to the <input> element's
            autocomplete property. If unspecified, this value will be set to
            "new-password" for "password" inputs, and the empty string for
            "default" inputs. For more details, see https://developer.mozilla.org/en-US/docs/Web/HTML/Attributes/autocomplete
        on_change : callable
            An optional callback invoked when this text_input's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        str
            The current value of the text input widget.

        Example
        -------
        >>> title = st.text_input('Movie title', 'Life of Brian')
        >>> st.write('The current movie title is', title)

        """
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None if value == "" else value, key=key)

        text_input_proto = TextInputProto()
        text_input_proto.label = label
        text_input_proto.default = str(value)
        text_input_proto.form_id = current_form_id(self.dg)
        if help is not None:
            text_input_proto.help = help

        if max_chars is not None:
            text_input_proto.max_chars = max_chars

        if type == "default":
            text_input_proto.type = TextInputProto.DEFAULT
        elif type == "password":
            text_input_proto.type = TextInputProto.PASSWORD
        else:
            raise StreamlitAPIException(
                "'%s' is not a valid text_input type. Valid types are 'default' and 'password'."
                % type
            )

        # Marshall the autocomplete param. If unspecified, this will be
        # set to "new-password" for password inputs.
        if autocomplete is None:
            autocomplete = "new-password" if type == "password" else ""
        text_input_proto.autocomplete = autocomplete

        def deserialize_text_input(ui_value, widget_id="") -> str:
            return str(ui_value if ui_value is not None else value)

        current_value, set_frontend_value = register_widget(
            "text_input",
            text_input_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_text_input,
            serializer=lambda x: x,
        )

        if set_frontend_value:
            text_input_proto.value = current_value
            text_input_proto.set_value = True

        self.dg._enqueue("text_input", text_input_proto)
        return current_value

    def text_area(
        self,
        label,
        value="",
        height=None,
        max_chars=None,
        key=None,
        help=None,
        on_change=None,
        args=None,
        kwargs=None,
    ):
        """Display a multi-line text input widget.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this input is for.
        value : any
            The text value of this widget when it first renders. This will be
            cast to str internally.
        height : int or None
            Desired height of the UI element expressed in pixels. If None, a
            default height is used.
        max_chars : int or None
            Maximum number of characters allowed in text area.
        key : str
            An optional string to use as the unique key for the widget.
            If this is omitted, a key will be generated for the widget
            based on its content. Multiple widgets of the same type may
            not share the same key.
        help : str
            An optional tooltip that gets displayed next to the textarea.
        on_change : callable
            An optional callback invoked when this text_area's value changes.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        str
            The current value of the text input widget.

        Example
        -------
        >>> txt = st.text_area('Text to analyze', '''
        ...     It was the best of times, it was the worst of times, it was
        ...     the age of wisdom, it was the age of foolishness, it was
        ...     the epoch of belief, it was the epoch of incredulity, it
        ...     was the season of Light, it was the season of Darkness, it
        ...     was the spring of hope, it was the winter of despair, (...)
        ...     ''')
        >>> st.write('Sentiment:', run_sentiment_analysis(txt))

        """
        check_callback_rules(self.dg, on_change)
        check_session_state_rules(default_value=None if value == "" else value, key=key)

        text_area_proto = TextAreaProto()
        text_area_proto.label = label
        text_area_proto.default = str(value)
        text_area_proto.form_id = current_form_id(self.dg)
        if help is not None:
            text_area_proto.help = help

        if height is not None:
            text_area_proto.height = height

        if max_chars is not None:
            text_area_proto.max_chars = max_chars

        def deserialize_text_area(ui_value, widget_id="") -> str:
            return str(ui_value if ui_value is not None else value)

        current_value, set_frontend_value = register_widget(
            "text_area",
            text_area_proto,
            user_key=key,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=deserialize_text_area,
            serializer=lambda x: x,
        )

        if set_frontend_value:
            text_area_proto.value = current_value
            text_area_proto.set_value = True

        self.dg._enqueue("text_area", text_area_proto)
        return current_value

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
