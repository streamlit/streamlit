# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022)
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
from __future__ import annotations

import urllib.parse
from typing import TYPE_CHECKING, Optional, cast

from streamlit.elements.form import FormData, build_duplicate_key_message, is_in_form
from streamlit.errors import StreamlitAPIException
from streamlit.proto import Block_pb2
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.PageInfo_pb2 import PageInfo
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator


class DialogMixin:
    @gather_metrics("dialog")
    def dialog(
        self,
        title: str,
        *,
        close_on_submit: bool = True,
        clear_on_close: bool = True,
        clear_on_submit: bool = False,
        dismissible: bool = True,
        key: Optional[str] = None,
    ) -> DeltaGenerator:
        """Create a modal dialog that shows up as an overlay on top of the app.

        A dialog is a container that contains elements and widgets.
        To add elements to a dialog, you can use `with` notation or just call methods directly on the dialog. See examples below.

        Dialogs work similarly to [forms](https://docs.streamlit.io/library/api-reference/control-flow/st.form):
            * It can contain one or multiple submit buttons via st.form_submit_button.
            * When the viewer interacts with a widget inside of a dialog, the app does not rerun.
                Only when a submit button is pressed, are all widget values inside the dialog sent to Streamlit in a batch.
            * `st.button` and `st.download_button` cannot be added to dialogs.
            * Dialogs cannot contain other dialogs or forms.
        But there are also some differences:
            * Dialogs do not have to contain a submit button (only if `dismissible` is set to False).
            * Dialogs need to be opened by calling their `.open()` method in order to show them. See examples below.
            * Dialogs are closed automatically when pressing a submit button, as long as close_on_submit is set to `True` (the default).
                If it is set to `False`, you need to manually close the dialog by calling `.close()` on it. See examples below.

        Parameters
        ----------
        title : str
            The title of the dialog, displayed at the top.
        close_on_submit : bool
             If `True`, the dialog with be closed when a submit button is pressed.
             If `False`, the dialog needs to be manually closed by calling `.close()` on the return object.
             This is useful e.g. to validate widget input and only close the dialog if it’s valid.
             Defaults to `True`.
        clear_on_close : bool
            If `True`, all widgets inside the dialog will be reset to their default values when the form closes.
            Defaults to `True`. Note that custom components are unaffected by this parameter and will not be reset.
        clear_on_submit : bool
            If `True`, all widgets inside the dialog will be reset to their default values when a submit button is pressed.
            Defaults to `False`. Note that custom components are unaffected by this parameter and will not be reset.
        dismissible : bool
             If `True`, the dialog shows a close button in the top right and can be dismissed by clicking
             on this button or on the background of the app, or by pressing `Esc`. Note: if `dismissible` is set to `False`,
             the dialog has to contain a submit button. Defaults to `True`.
        key : str
            A string that identifies the dialog. If this is omitted, a key will be generated for the dialog based on its title.

        Examples
        --------
        Create a simple dialog that just shows text to the user:

        >>> import streamlit as st
        >>>
        >>> dial = st.dialog("Warning")
        >>> dial.write("Here's a warning!")
        >>>
        >>> if st.button("Show warning"):
        >>>     dial.open()
        >>>

        Of course, you could also show charts, dataframes, or any other static element instead.
        Note that this dialog doesn’t contain a submit button.
        That’s valid as long as you don’t set `dismissible` to `False`.

        Create a dialog with interactive widgets and retrieve their values:

        >>> import streamlit as st
        >>>
        >>> dial = st.dialog("Data entry")
        >>> with dial:
        >>>     name = st.text_input("What's your name?")
        >>>     age = st.number_input("What's your age?", min_value=0)
        >>>     submitted = st.form_submit_button("Submit")
        >>>
        >>> if st.button("Enter data"):
        >>>     dial.open()
        >>>
        >>> if submitted:
        >>>     st.write(f"Your name is {name} and you are {age} years old.")
        >>>

        Note that you should **always** create the dialog outside of where you are actually opening it!
        Here, we are creating the dialog on the top level of the code. Inside the `if st.button(”Enter data”)` block,
        we are just calling `dial.open()`. If you would also create the dialog inside of that block,
        it would be impossible to retrieve name and age, the return values of the widgets:
        the dialog code would only be run directly after the viewer pressed the “Enter data” button.
        Once they click the submit button inside the dialog, the “Enter data” button would return False again,
        and the dialog code wouldn’t be called at all – therefore not setting name and age.

        Create a dialog that is closed programmatically, e.g. after validating the user input:

        >>> import streamlit as st
        >>>
        >>> forbidden_animals = ["Lion", "Snake", "Shark"]
        >>>
        >>> dial = st.dialog("Animal check", close_on_submit=False)
        >>> with dial:
        >>>     animal = st.text_input("Enter the animal")
        >>>     if st.form_submit_button("Submit"):
        >>>         if animal in forbidden_animals:
        >>>             st.error("This animal is forbidden! Try another one.")
        >>>         else:
        >>>             dial.close()
        >>>
        >>> if st.button("Check an animal"):
        >>>     dial.open()
        >>>

        """

        # Import this here to avoid circular imports.
        from streamlit.elements.utils import check_session_state_rules

        if is_in_form(self.dg):
            raise StreamlitAPIException("Forms cannot be nested in other forms.")

        if not key:
            key = title

        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        # A form is uniquely identified by its key.
        form_id = key

        ctx = get_script_run_ctx()
        if ctx is not None:
            new_form_id = form_id not in ctx.form_ids_this_run
            if new_form_id:
                ctx.form_ids_this_run.add(form_id)
            else:
                raise StreamlitAPIException(build_duplicate_key_message(key))

        block_proto = Block_pb2.Block()
        block_proto.form.is_dialog = True
        block_proto.form.title = title
        block_proto.form.form_id = form_id
        block_proto.form.clear_on_submit = clear_on_submit
        block_proto.form.close_on_submit = close_on_submit
        block_proto.form.clear_on_close = clear_on_close
        block_proto.form.dismissible = dismissible
        block_dg = self.dg._block(block_proto)

        # Attach the form's button info to the newly-created block's
        # DeltaGenerator.
        block_dg._form_data = FormData(form_id)
        return block_dg

    def open(self):
        if not self.dg._form_data:
            return
        form_id = urllib.parse.quote_plus(self.dg._form_data.form_id.strip().lower())
        ctx = get_script_run_ctx()
        if not ctx:
            return
        if f"_stcore_open_dialog_{form_id}" in ctx.query_string:
            return
        txt = f"_stcore_open_dialog_{form_id}=true"
        if not ctx.query_string:
            ctx.query_string = f"{txt}"
        else:
            ctx.query_string = f"{ctx.query_string}&{txt}"
        ctx.enqueue(
            ForwardMsg(page_info_changed=PageInfo(query_string=ctx.query_string))
        )

    def close(self):
        if not self.dg._form_data:
            return
        form_id = urllib.parse.quote_plus(self.dg._form_data.form_id.strip().lower())
        ctx = get_script_run_ctx()
        if not ctx:
            return
        if f"_stcore_close_dialog_{form_id}" in ctx.query_string:
            return
        txt = f"_stcore_close_dialog_{form_id}=true"
        if not ctx.query_string:
            ctx.query_string = f"{txt}"
        else:
            ctx.query_string = f"{ctx.query_string}&{txt}"
        ctx.enqueue(
            ForwardMsg(page_info_changed=PageInfo(query_string=ctx.query_string))
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
