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

import uuid
from typing import TYPE_CHECKING, Optional, cast

from typing_extensions import Literal

from streamlit.elements import form
from streamlit.errors import StreamlitAPIException
from streamlit.proto import Block_pb2
from streamlit.proto.AlertTypeMessage_pb2 import AlertTypeMessage
from streamlit.runtime.app_session import create_update_open_modal_id_modal_event
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import get_script_run_ctx
from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.type_util import SupportsStr


def build_modal_proto(
    form_id: str,
    clear_on_submit: bool,
    title: str,
    can_be_closed: bool,
    type: Block_pb2.Block.ModalType.ValueType,
    unsafe_allow_html: bool = False,
    body: "SupportsStr" = "",
    alert: AlertTypeMessage.AlertTypeOptions.ValueType = AlertTypeMessage.NONE,
):
    return Block_pb2.Block(
        modal=Block_pb2.Block.Modal(
            form_id=form_id,
            clear_on_submit=clear_on_submit,
            title=title,
            can_be_closed=can_be_closed,
            type=type,
            unsafe_allow_html=unsafe_allow_html,
            body=str(body),
            alert=AlertTypeMessage(value=alert),
        )
    )


ALERT_TYPE_MAPPING = {
    "default": AlertTypeMessage.DEFAULT,
    "error": AlertTypeMessage.ERROR,
    "warning": AlertTypeMessage.WARNING,
    "info": AlertTypeMessage.INFO,
    "success": AlertTypeMessage.SUCCESS,
}


class ModalMixin:
    @gather_metrics("experimental_modal_form")
    def experimental_modal_form(
        self,
        key: str,
        clear_on_submit: bool = False,
        title: str = "",
        on_close_button_clicked: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only args:
        can_be_closed: bool = True,
    ):
        """Create a modal form that batches elements together with a "Submit" button.

        A modal is a container that groups other elements and widgets together,
        in a way similar to the form, but these elements ale displayed in a modal
         instead of the main container, similiary as form it contains a Submit button.
         When the modal's Submit button is pressed, all widget values inside the modal will be
        sent to Streamlit in a batch.

        To add elements to a modal object, you can use "with" notation
        (preferred) or just call methods directly on the form. See
        examples below.

        Forms have a few constraints:

        * Every modal must contain a ``st.modal_submit_button``.
        * Modal can appear anywhere in your app (sidebar, columns, etc),
          but they cannot be embedded inside other modals or forms.

        Parameters
        ----------
        key : str
            A string that identifies the modal. Each modal must have its own
            key. (This key is not displayed to the user in the interface.)
        clear_on_submit : bool
            If True, all widgets inside the modal will be reset to their default
            values after the user presses the Submit button. Defaults to False.
            (Note that Custom Components are unaffected by this flag, and
            will not be reset to their defaults on modal submission.)
        title : str
            Modal Title to be displayed in header.
            Title is an empty string "" by default, which results in no string inside modal header.
        on_close_button_clicked : callable
            An optional callback invoked when this button is clicked.
            When provided remember to close the modal manually using modal.close() method.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        can_be_closed : bool
            If True close button on the modal alert will appear,
            the click on the button will close the modal or call on_close_button_clicked if provided.

        Examples
        --------
        Inserting elements using "with" notation:

        >>> import streamlit as st
        >>>
        >>> modal_form = st.experimental_modal_form("my_modal")
        >>>
        >>> def cta_callback():
        ...     st.write(f"Hey {st.session_state.first_name} {st.session_state.last_name}!")
        ...     st.write(f"Your preferences are saved")
        ...     modal_form.close()
        >>>
        >>> with modal_form:
        ...    st.text_input("First name", key="first_name")
        ...    st.text_input("Last name", key="last_name")
        ...    st.checkbox("I accept cookies", key="cookies")
        ...    st.form_submit_button("OK", on_click=cta_callback)
        ...
        >>>
        >>> if st.button("Open modal"):
        ...     modal_form.open()
        >>>
        """
        # Import this here to avoid circular imports.
        from streamlit.elements.utils import check_session_state_rules

        if form.is_in_form(self.dg):
            raise StreamlitAPIException("Forms cannot be nested in other forms.")

        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        form_id = form.build_form_id(key)

        modal_proto = build_modal_proto(
            title=title,
            form_id=form_id,
            clear_on_submit=clear_on_submit,
            can_be_closed=can_be_closed,
            type=Block_pb2.Block.ModalType.FORM,
        )
        block_dg = self.dg._block(modal_proto)

        # Attach the modal's button info to the newly-created block's
        # DeltaGenerator.
        block_dg._form_data = form.FormData(form_id)

        self._add_close_button_to_modal(
            block_dg,
            can_be_closed=can_be_closed,
            on_close_button_clicked=on_close_button_clicked,
            args=args,
            kwargs=kwargs,
        )
        return block_dg

    @gather_metrics("experimental_modal_alert")
    def experimental_modal_alert(
        self,
        body: "SupportsStr",
        title: str = "",
        on_close_button_clicked: Optional[WidgetCallback] = None,
        args: Optional[WidgetArgs] = None,
        kwargs: Optional[WidgetKwargs] = None,
        *,  # keyword-only args:
        type: Literal["default", "error", "warning", "info", "success"] = "default",
        can_be_closed: bool = True,
        unsafe_allow_html: bool = False,
    ):
        """Create a modal alert that displays user defined text, which can be markdown.

        Parameters
        ----------
        body : str
            The text/markdown text to display.
        title : str
            Modal Title to be displayed in header.
            Title is an empty string "" by default, which results in no string inside modal header.
        on_close_button_clicked : callable
            An optional callback invoked when this button is clicked.
            When provided remember to close the modal manually using modal.close() method.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        type : "default", "error", "warning", "info", "success"
            An optional string that specifies the modal alert style. Default is white.
        can_be_closed : bool
            If True close button on the modal alert will appear,
            the click on the button will close the modal or call on_close_button_clicked if provided.
        unsafe_allow_html : bool
            This is a keyword-only argument that defaults to False.

            By default, any HTML tags found in strings will be escaped and
            therefore treated as pure text. This behavior may be turned off by
            setting this argument to True.

            That said, *we strongly advise against it*. It is hard to write secure
            HTML, so by using this argument you may be compromising your users'
            security. For more information, see:

            https://github.com/streamlit/streamlit/issues/152

        >>> import streamlit as st
        >>>
        >>> def close_button_clicked_callback():
        ...     st.write("# Hello from close modal alert callback!")
        ...     modal_alert.close()
        >>>
        >>> modal_alert = st.experimental_modal_alert(
        ...     "# This is modal alert example!",
        ...     on_click=close_button_clicked_callback,
        ...     can_be_closed=True)
        >>>
        >>> if st.button("Show modal alert!"):
        ...     modal_alert.open()
        >>>
        """
        if type not in ALERT_TYPE_MAPPING.keys():
            raise StreamlitAPIException(
                f'The type argument to st.modal_alert must be {", ".join(ALERT_TYPE_MAPPING.keys())}. \n'
                f'The argument passed was "{type}".'
            )

        # use uuid4 as form_id to reuse modal open/close mechanism
        form_id = str(uuid.uuid4().hex)

        alert_type = ALERT_TYPE_MAPPING[type]
        alert_proto = build_modal_proto(
            form_id=form_id,
            clear_on_submit=False,
            title=title,
            can_be_closed=can_be_closed,
            type=Block_pb2.Block.ModalType.ALERT,
            alert=alert_type,
            body=body,
            unsafe_allow_html=unsafe_allow_html,
        )
        block_dg = self.dg._block(alert_proto)

        # use uuid4 as form_id to reuse modal open/close mechanism
        block_dg._form_data = form.FormData(form_id)

        self._add_close_button_to_modal(
            block_dg,
            can_be_closed=can_be_closed,
            on_close_button_clicked=on_close_button_clicked,
            args=args,
            kwargs=kwargs,
            type=alert_type,
        )
        return block_dg

    def open(self):
        # use get_script_run_ctx instead of ctx, because context is dynamic and can change
        ctx = get_script_run_ctx()
        if ctx:
            ctx.enqueue(
                create_update_open_modal_id_modal_event(
                    open_modal_id=form.current_form_id(self.dg)
                )
            )

    def close(self):
        # use get_script_run_ctx instead of ctx, because context is dynamic and can change
        ctx = get_script_run_ctx()
        if ctx:
            # empty open_modal_id, should effectively close the modal
            ctx.enqueue(create_update_open_modal_id_modal_event(open_modal_id=""))

    def _add_close_button_to_modal(
        self,
        block_dg: "DeltaGenerator",
        can_be_closed: bool,
        on_close_button_clicked: Optional[WidgetCallback],
        args: Optional[WidgetArgs],
        kwargs: Optional[WidgetKwargs],
        type: AlertTypeMessage.AlertTypeOptions.ValueType = AlertTypeMessage.NONE,
    ):
        """Adds modal close button to modal delta generator if can be closed is True.
        Otherwise does not add close button, which results in user being unable to close the modal.
        """
        ctx = get_script_run_ctx()
        if can_be_closed and on_close_button_clicked:
            block_dg._form_submit_button(
                "",
                on_click=on_close_button_clicked,
                args=args,
                kwargs=kwargs,
                is_modal_close_button=True,
                alert_type=type,
                ctx=ctx,
            )
        elif can_be_closed:
            block_dg._form_submit_button(
                "",
                on_click=self.close,
                is_modal_close_button=True,
                alert_type=type,
                ctx=ctx,
            )
        else:
            pass  # do not add modal_close_button to delta generator when can_be_closed is False

    @property
    def dg(self) -> "DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast(DeltaGenerator, self)
