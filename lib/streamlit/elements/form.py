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

import textwrap
from typing import cast, Optional, NamedTuple

import streamlit
from streamlit.errors import StreamlitAPIException
from streamlit.proto import Block_pb2
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx
from streamlit.runtime.metrics_util import gather_metrics


class FormData(NamedTuple):
    """Form data stored on a DeltaGenerator."""

    # The form's unique ID.
    form_id: str


def _current_form(
    this_dg: "streamlit.delta_generator.DeltaGenerator",
) -> Optional[FormData]:
    """Find the FormData for the given DeltaGenerator.

    Forms are blocks, and can have other blocks nested inside them.
    To find the current form, we walk up the dg_stack until we find
    a DeltaGenerator that has FormData.
    """
    if not streamlit._is_running_with_streamlit:
        return None

    if this_dg._form_data is not None:
        return this_dg._form_data

    if this_dg == this_dg._main_dg:
        # We were created via an `st.foo` call.
        # Walk up the dg_stack to see if we're nested inside a `with st.form` statement.
        ctx = get_script_run_ctx()
        if ctx is None or len(ctx.dg_stack) == 0:
            return None

        for dg in reversed(ctx.dg_stack):
            if dg._form_data is not None:
                return dg._form_data
    else:
        # We were created via an `dg.foo` call.
        # Take a look at our parent's form data to see if we're nested inside a form.
        parent = this_dg._parent
        if parent is not None and parent._form_data is not None:
            return parent._form_data

    return None


def current_form_id(dg: "streamlit.delta_generator.DeltaGenerator") -> str:
    """Return the form_id for the current form, or the empty string if we're
    not inside an `st.form` block.

    (We return the empty string, instead of None, because this value is
    assigned to protobuf message fields, and None is not valid.)
    """
    form_data = _current_form(dg)
    if form_data is None:
        return ""
    return form_data.form_id


def is_in_form(dg: "streamlit.delta_generator.DeltaGenerator") -> bool:
    """True if the DeltaGenerator is inside an st.form block."""
    return current_form_id(dg) != ""


def _build_duplicate_form_message(user_key: Optional[str] = None) -> str:
    if user_key is not None:
        message = textwrap.dedent(
            f"""
            There are multiple identical forms with `key='{user_key}'`.

            To fix this, please make sure that the `key` argument is unique for
            each `st.form` you create.
            """
        )
    else:
        message = textwrap.dedent(
            """
            There are multiple identical forms with the same generated key.

            When a form is created, it's assigned an internal key based on
            its structure. Multiple forms with an identical structure will
            result in the same internal key, which causes this error.

            To fix this error, please pass a unique `key` argument to
            `st.form`.
            """
        )

    return message.strip("\n")


class FormMixin:
    @gather_metrics
    def form(self, key: str, clear_on_submit: bool = False):
        """Create a form that batches elements together with a "Submit" button.

        A form is a container that visually groups other elements and
        widgets together, and contains a Submit button. When the form's
        Submit button is pressed, all widget values inside the form will be
        sent to Streamlit in a batch.

        To add elements to a form object, you can use "with" notation
        (preferred) or just call methods directly on the form. See
        examples below.

        Forms have a few constraints:

        * Every form must contain a ``st.form_submit_button``.
        * ``st.button`` and ``st.download_button`` cannot be added to a form.
        * Forms can appear anywhere in your app (sidebar, columns, etc),
          but they cannot be embedded inside other forms.

        For more information about forms, check out our
        `blog post <https://blog.streamlit.io/introducing-submit-button-and-forms/>`_.

        Parameters
        ----------
        key : str
            A string that identifies the form. Each form must have its own
            key. (This key is not displayed to the user in the interface.)
        clear_on_submit : bool
            If True, all widgets inside the form will be reset to their default
            values after the user presses the Submit button. Defaults to False.
            (Note that Custom Components are unaffected by this flag, and
            will not be reset to their defaults on form submission.)

        Examples
        --------

        Inserting elements using "with" notation:

        >>> with st.form("my_form"):
        ...    st.write("Inside the form")
        ...    slider_val = st.slider("Form slider")
        ...    checkbox_val = st.checkbox("Form checkbox")
        ...
        ...    # Every form must have a submit button.
        ...    submitted = st.form_submit_button("Submit")
        ...    if submitted:
        ...        st.write("slider", slider_val, "checkbox", checkbox_val)
        ...
        >>> st.write("Outside the form")

        Inserting elements out of order:

        >>> form = st.form("my_form")
        >>> form.slider("Inside the form")
        >>> st.slider("Outside the form")
        >>>
        >>> # Now add a submit button to the form:
        >>> form.form_submit_button("Submit")

        """
        from streamlit.elements.utils import check_session_state_rules

        if is_in_form(self.dg):
            raise StreamlitAPIException("Forms cannot be nested in other forms.")

        check_session_state_rules(default_value=None, key=key, writes_allowed=False)

        # A form is uniquely identified by its key.
        form_id = key

        ctx = get_script_run_ctx()
        if ctx is not None:
            new_form_id = form_id not in ctx.form_ids_this_run
            if new_form_id:
                ctx.form_ids_this_run.add(form_id)
            else:
                raise StreamlitAPIException(_build_duplicate_form_message(key))

        block_proto = Block_pb2.Block()
        block_proto.form.form_id = form_id
        block_proto.form.clear_on_submit = clear_on_submit
        block_dg = self.dg._block(block_proto)

        # Attach the form's button info to the newly-created block's
        # DeltaGenerator.
        block_dg._form_data = FormData(form_id)
        return block_dg

    @gather_metrics
    def form_submit_button(
        self,
        label: str = "Submit",
        help: Optional[str] = None,
        on_click=None,
        args=None,
        kwargs=None,
    ) -> bool:
        """Display a form submit button.

        When this button is clicked, all widget values inside the form will be
        sent to Streamlit in a batch.

        Every form must have a form_submit_button. A form_submit_button
        cannot exist outside a form.

        For more information about forms, check out our
        `blog post <https://blog.streamlit.io/introducing-submit-button-and-forms/>`_.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for.
            Defaults to "Submit".
        help : str or None
            A tooltip that gets displayed when the button is hovered over.
            Defaults to None.
        on_click : callable
            An optional callback invoked when this button is clicked.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        Returns
        -------
        bool
            True if the button was clicked.
        """
        ctx = get_script_run_ctx()
        return self._form_submit_button(
            label=label,
            help=help,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            ctx=ctx,
        )

    def _form_submit_button(
        self,
        label: str = "Submit",
        help: Optional[str] = None,
        on_click=None,
        args=None,
        kwargs=None,
        ctx: Optional[ScriptRunContext] = None,
    ) -> bool:
        form_id = current_form_id(self.dg)
        submit_button_key = f"FormSubmitter:{form_id}-{label}"
        return self.dg._button(
            label=label,
            key=submit_button_key,
            help=help,
            is_form_submitter=True,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            ctx=ctx,
        )

    @property
    def dg(self) -> "streamlit.delta_generator.DeltaGenerator":
        """Get our DeltaGenerator."""
        return cast("streamlit.delta_generator.DeltaGenerator", self)
