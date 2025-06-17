# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2025)
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

import textwrap
from typing import TYPE_CHECKING, Literal, cast

from streamlit.elements.lib.form_utils import FormData, current_form_id, is_in_form
from streamlit.elements.lib.layout_utils import (
    Width,
    get_height_config,
    get_width_config,
    validate_height,
    validate_width,
)
from streamlit.elements.lib.policies import (
    check_cache_replay_rules,
    check_session_state_rules,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto import Block_pb2
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner import ScriptRunContext, get_script_run_ctx

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import WidgetArgs, WidgetCallback, WidgetKwargs


def _build_duplicate_form_message(user_key: str | None = None) -> str:
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
    @gather_metrics("form")
    def form(
        self,
        key: str,
        clear_on_submit: bool = False,
        *,
        enter_to_submit: bool = True,
        border: bool = True,
        width: Width = "stretch",
        height: int | Literal["content"] = "content",
    ) -> DeltaGenerator:
        """Create a form that batches elements together with a "Submit" button.

        A form is a container that visually groups other elements and
        widgets together, and contains a Submit button. When the form's
        Submit button is pressed, all widget values inside the form will be
        sent to Streamlit in a batch.

        To add elements to a form object, you can use ``with`` notation
        (preferred) or just call methods directly on the form. See
        examples below.

        Forms have a few constraints:

        - Every form must contain a ``st.form_submit_button``.
        - ``st.button`` and ``st.download_button`` cannot be added to a form.
        - Forms can appear anywhere in your app (sidebar, columns, etc),
          but they cannot be embedded inside other forms.
        - Within a form, the only widget that can have a callback function is
          ``st.form_submit_button``.

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
        enter_to_submit : bool
            Whether to submit the form when a user presses Enter while
            interacting with a widget inside the form.

            If this is ``True`` (default), pressing Enter while interacting
            with a form widget is equivalent to clicking the first
            ``st.form_submit_button`` in the form.

            If this is ``False``, the user must click an
            ``st.form_submit_button`` to submit the form.

            If the first ``st.form_submit_button`` in the form is disabled,
            the form will override submission behavior with
            ``enter_to_submit=False``.

        border : bool
            Whether to show a border around the form. Defaults to True.

            .. note::
                Not showing a border can be confusing to viewers since interacting with a
                widget in the form will do nothing. You should only remove the border if
                there's another border (e.g. because of an expander) or the form is small
                (e.g. just a text input and a submit button).

        width : "stretch", "content", or int
            The width of the form container. This can be one of the following:

            - ``"stretch"`` (default): The width of the container matches the
              width of the parent container.
            - ``"content"``: The width of the container matches the width of its
              content, but doesn't exceed the width of the parent container.
            - An integer specifying the width in pixels: The container has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the container matches the width
              of the parent container.

        height : "content" or int
            The height of the form container. This can be one of the following:

            - ``"content"`` (default): The height of the container matches the
              height of its content.
            - An integer specifying the height in pixels: The container has a
              fixed height. If the content is larger than the specified
              height, scrolling is enabled.

            .. note::
                Use scrolling containers sparingly. If you use scrolling
                containers, avoid heights that exceed 500 pixels. Otherwise,
                the scroll surface of the container might cover the majority of
                the screen on mobile devices, which makes it hard to scroll the
                rest of the app.

        Examples
        --------
        Inserting elements using ``with`` notation:

        >>> import streamlit as st
        >>>
        >>> with st.form("my_form"):
        ...     st.write("Inside the form")
        ...     slider_val = st.slider("Form slider")
        ...     checkbox_val = st.checkbox("Form checkbox")
        ...
        ...     # Every form must have a submit button.
        ...     submitted = st.form_submit_button("Submit")
        ...     if submitted:
        ...         st.write("slider", slider_val, "checkbox", checkbox_val)
        >>> st.write("Outside the form")

        .. output::
           https://doc-form1.streamlit.app/
           height: 425px

        Inserting elements out of order:

        >>> import streamlit as st
        >>>
        >>> form = st.form("my_form")
        >>> form.slider("Inside the form")
        >>> st.slider("Outside the form")
        >>>
        >>> # Now add a submit button to the form:
        >>> form.form_submit_button("Submit")

        .. output::
           https://doc-form2.streamlit.app/
           height: 375px

        """
        if is_in_form(self.dg):
            raise StreamlitAPIException("Forms cannot be nested in other forms.")

        check_cache_replay_rules()
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
        block_proto.form.enter_to_submit = enter_to_submit
        block_proto.form.border = border
        validate_width(width, allow_content=True)
        block_proto.width_config.CopyFrom(get_width_config(width))
        validate_height(height, allow_content=True)
        block_proto.height_config.CopyFrom(get_height_config(height))
        block_dg = self.dg._block(block_proto)

        # Attach the form's button info to the newly-created block's
        # DeltaGenerator.
        block_dg._form_data = FormData(form_id)
        return block_dg

    @gather_metrics("form_submit_button")
    def form_submit_button(
        self,
        label: str = "Submit",
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
    ) -> bool:
        r"""Display a form submit button.

        When this button is clicked, all widget values inside the form will be
        sent from the user's browser to your Streamlit server in a batch.

        Every form must have at least one ``st.form_submit_button``. An
        ``st.form_submit_button`` cannot exist outside of a form.

        For more information about forms, check out our `docs
        <https://docs.streamlit.io/develop/concepts/architecture/forms>`_.

        Parameters
        ----------
        label : str
            A short label explaining to the user what this button is for. This
            defaults to ``"Submit"``. The label can optionally contain
            GitHub-flavored Markdown of the following types: Bold, Italics,
            Strikethroughs, Inline Code, Links, and Images. Images display like
            icons, with a max height equal to the font height.

            Unsupported Markdown elements are unwrapped so only their children
            (text contents) render. Display unsupported elements as literal
            characters by backslash-escaping them. E.g.,
            ``"1\. Not an ordered list"``.

            See the ``body`` parameter of |st.markdown|_ for additional,
            supported Markdown directives.

            .. |st.markdown| replace:: ``st.markdown``
            .. _st.markdown: https://docs.streamlit.io/develop/api-reference/text/st.markdown
        help : str or None
            A tooltip that gets displayed when the button is hovered over. If
            this is ``None`` (default), no tooltip is displayed.

            The tooltip can optionally contain GitHub-flavored Markdown,
            including the Markdown directives described in the ``body``
            parameter of ``st.markdown``.
        on_click : callable
            An optional callback invoked when this button is clicked.
        args : tuple
            An optional tuple of args to pass to the callback.
        kwargs : dict
            An optional dict of kwargs to pass to the callback.
        type : "primary", "secondary", or "tertiary"
            An optional string that specifies the button type. This can be one
            of the following:

            - ``"primary"``: The button's background is the app's primary color
              for additional emphasis.
            - ``"secondary"`` (default): The button's background coordinates
              with the app's background color for normal emphasis.
            - ``"tertiary"``: The button is plain text without a border or
              background for subtly.

        icon : str or None
            An optional emoji or icon to display next to the button label. If ``icon``
            is ``None`` (default), no icon is displayed. If ``icon`` is a
            string, the following options are valid:

            - A single-character emoji. For example, you can set ``icon="🚨"``
              or ``icon="🔥"``. Emoji short codes are not supported.

            - An icon from the Material Symbols library (rounded style) in the
              format ``":material/icon_name:"`` where "icon_name" is the name
              of the icon in snake case.

              For example, ``icon=":material/thumb_up:"`` will display the
              Thumb Up icon. Find additional icons in the `Material Symbols
              <https://fonts.google.com/icons?icon.set=Material+Symbols&icon.style=Rounded>`_
              font library.
        disabled : bool
            Whether to disable the button. If this is ``False`` (default), the
            user can interact with the button. If this is ``True``, the button
            is grayed-out and can't be clicked.

            If the first ``st.form_submit_button`` in the form is disabled,
            the form will override submission behavior with
            ``enter_to_submit=False``.

        use_container_width : bool
            Whether to expand the button's width to fill its parent container.
            If ``use_container_width`` is ``False`` (default), Streamlit sizes
            the button to fit its contents. If ``use_container_width`` is
            ``True``, the width of the button matches its parent container.

            In both cases, if the contents of the button are wider than the
            parent container, the contents will line wrap.

        Returns
        -------
        bool
            True if the button was clicked.
        """
        ctx = get_script_run_ctx()

        # Checks whether the entered button type is one of the allowed options
        if type not in ["primary", "secondary", "tertiary"]:
            raise StreamlitAPIException(
                'The type argument to st.form_submit_button must be "primary", "secondary", or "tertiary". \n'
                f'The argument passed was "{type}".'
            )

        return self._form_submit_button(
            label=label,
            help=help,
            on_click=on_click,
            args=args,
            kwargs=kwargs,
            type=type,
            icon=icon,
            disabled=disabled,
            use_container_width=use_container_width,
            ctx=ctx,
        )

    def _form_submit_button(
        self,
        label: str = "Submit",
        help: str | None = None,
        on_click: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        *,  # keyword-only arguments:
        type: Literal["primary", "secondary", "tertiary"] = "secondary",
        icon: str | None = None,
        disabled: bool = False,
        use_container_width: bool = False,
        ctx: ScriptRunContext | None = None,
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
            type=type,
            icon=icon,
            disabled=disabled,
            use_container_width=use_container_width,
            ctx=ctx,
        )

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
