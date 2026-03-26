# Copyright (c) Streamlit Inc. (2018-2022) Snowflake Inc. (2022-2026)
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

from typing import (
    TYPE_CHECKING,
    Final,
    Literal,
    cast,
    overload,
)

from streamlit.elements.lib.form_utils import current_form_id
from streamlit.elements.lib.layout_utils import (
    Width,
    create_layout_config,
)
from streamlit.elements.lib.policies import check_widget_policies
from streamlit.elements.lib.utils import (
    Key,
    compute_and_register_element_id,
    save_for_app_testing,
    to_key,
)
from streamlit.errors import StreamlitAPIException
from streamlit.proto.Feedback_pb2 import Feedback as FeedbackProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import register_widget

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        WidgetArgs,
        WidgetCallback,
        WidgetKwargs,
    )


# Number of options for each feedback type
_NUM_THUMBS_OPTIONS: Final = 2
_NUM_FACES_OPTIONS: Final = 5
_NUM_STARS_OPTIONS: Final = 5


def _get_num_options(feedback_type: Literal["thumbs", "faces", "stars"]) -> int:
    """Get the number of options for the given feedback type."""
    if feedback_type == "thumbs":
        return _NUM_THUMBS_OPTIONS
    if feedback_type == "faces":
        return _NUM_FACES_OPTIONS
    return _NUM_STARS_OPTIONS


def _feedback_type_to_proto(
    feedback_type: Literal["thumbs", "faces", "stars"],
) -> FeedbackProto.FeedbackType.ValueType:
    """Convert a feedback type string to the proto enum value."""
    if feedback_type == "thumbs":
        return FeedbackProto.FeedbackType.THUMBS
    if feedback_type == "faces":
        return FeedbackProto.FeedbackType.FACES
    return FeedbackProto.FeedbackType.STARS


class FeedbackSerde:
    """Serializer/deserializer for feedback widget values.

    Uses string as the wire format to distinguish three states:
    - None (field not set): No UI interaction yet -> use default_value
    - "" (empty string): User explicitly cleared -> return None
    - "2" (string with value): User selected -> return int value

    This allows clearing to work correctly even when a default is set.
    The session state and return values are always int | None.
    """

    def __init__(self, default_value: int | None = None):
        self.default_value = default_value

    def serialize(self, value: int | None) -> str:
        """Serialize int value to string for wire format."""
        return "" if value is None else str(value)

    def deserialize(self, ui_value: str | None) -> int | None:
        """Deserialize string wire format back to int value."""
        if ui_value is None:
            return self.default_value  # No UI interaction yet
        if ui_value == "":
            return None  # User explicitly cleared
        return int(ui_value)  # User selected a value


class FeedbackMixin:
    @overload
    def feedback(
        self,
        options: Literal["thumbs"] = ...,
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
    ) -> Literal[0, 1] | None: ...

    @overload
    def feedback(
        self,
        options: Literal["faces", "stars"] = ...,
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
    ) -> Literal[0, 1, 2, 3, 4] | None: ...

    @gather_metrics("feedback")
    def feedback(
        self,
        options: Literal["thumbs", "faces", "stars"] = "thumbs",
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | None = None,
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
    ) -> int | None:
        """Display a feedback widget.

        A feedback widget is an icon-based button group available in three
        styles, as described in ``options``. It is commonly used in chat and AI
        apps to allow users to rate responses.

        Parameters
        ----------
        options : "thumbs", "faces", or "stars"
            The feedback options displayed to the user. ``options`` can be one
            of the following:

            - ``"thumbs"`` (default): Streamlit displays a thumb-up and
              thumb-down button group.
            - ``"faces"``: Streamlit displays a row of five buttons with
              facial expressions depicting increasing satisfaction from left to
              right.
            - ``"stars"``: Streamlit displays a row of star icons, allowing the
              user to select a rating from one to five stars.

        key : str, int, or None
            An optional string or integer to use as the unique key for
            the widget. If this is ``None`` (default), a key will be
            generated for the widget based on the values of the other
            parameters. No two widgets may have the same key. Assigning
            a key stabilizes the widget's identity and preserves its
            state across reruns even when other parameters change.

            .. note::
               Changing ``options`` resets the widget even when a key is
               provided.

            A key lets you read or update the widget's value via
            ``st.session_state[key]``. For more details, see `Widget
            behavior <https://docs.streamlit.io/develop/concepts/architecture/widget-behavior>`_.

            Additionally, if ``key`` is provided, it will be used as a
            CSS class name prefixed with ``st-key-``.

        default : int or None
            Default feedback value. This must be consistent with the feedback
            type in ``options``:

            - 0 or 1 if ``options="thumbs"``.
            - Between 0 and 4, inclusive, if ``options="faces"`` or
              ``options="stars"``.

        disabled : bool
            An optional boolean that disables the feedback widget if set
            to ``True``. The default is ``False``.

        on_change : callable
            An optional callback invoked when this feedback widget's value
            changes.

        args : list or tuple
            An optional list or tuple of args to pass to the callback.

        kwargs : dict
            An optional dict of kwargs to pass to the callback.

        width : "content", "stretch", or int
            The width of the feedback widget. This can be one of the following:

            - ``"content"`` (default): The width of the widget matches the
              width of its content, but doesn't exceed the width of the parent
              container.
            - ``"stretch"``: The width of the widget matches the width of the
              parent container.
            - An integer specifying the width in pixels: The widget has a
              fixed width. If the specified width is greater than the width of
              the parent container, the width of the widget matches the width
              of the parent container.

        Returns
        -------
        int or None
            An integer indicating the user's selection, where ``0`` is the
            lowest feedback. Higher values indicate more positive feedback.
            If no option was selected, the widget returns ``None``.

            - For ``options="thumbs"``, a return value of ``0`` indicates
              thumbs-down, and ``1`` indicates thumbs-up.
            - For ``options="faces"`` and ``options="stars"``, return values
              range from ``0`` (least satisfied) to ``4`` (most satisfied).

        Examples
        --------
        Display a feedback widget with stars, and show the selected sentiment:

        >>> import streamlit as st
        >>>
        >>> sentiment_mapping = ["one", "two", "three", "four", "five"]
        >>> selected = st.feedback("stars")
        >>> if selected is not None:
        >>>     st.markdown(f"You selected {sentiment_mapping[selected]} star(s).")

        .. output::
            https://doc-feedback-stars.streamlit.app/
            height: 200px

        Display a feedback widget with thumbs, and show the selected sentiment:

        >>> import streamlit as st
        >>>
        >>> sentiment_mapping = [":material/thumb_down:", ":material/thumb_up:"]
        >>> selected = st.feedback("thumbs")
        >>> if selected is not None:
        >>>     st.markdown(f"You selected: {sentiment_mapping[selected]}")

        .. output::
            https://doc-feedback-thumbs.streamlit.app/
            height: 200px

        """
        if options not in {"thumbs", "faces", "stars"}:
            raise StreamlitAPIException(
                "The options argument to st.feedback must be one of "
                "['thumbs', 'faces', 'stars']. "
                f"The argument passed was '{options}'."
            )

        num_options = _get_num_options(options)

        if default is not None and (default < 0 or default >= num_options):
            raise StreamlitAPIException(
                f"The default value in '{options}' must be a number between 0 and {num_options - 1}."
                f" The passed default value is {default}"
            )

        key = to_key(key)
        layout_config = create_layout_config(width=width, allow_content_width=True)

        check_widget_policies(self.dg, key, on_change, default_value=default)

        ctx = get_script_run_ctx()
        form_id = current_form_id(self.dg)

        element_id = compute_and_register_element_id(
            "feedback",
            user_key=key,
            key_as_main_identity={"options"},
            dg=self.dg,
            options=options,
            default=default,
            width=width,
        )

        # Build the proto
        proto = FeedbackProto()
        proto.id = element_id
        proto.type = _feedback_type_to_proto(options)
        proto.disabled = disabled
        proto.form_id = form_id

        if default is not None:
            proto.default = default

        serde = FeedbackSerde(default_value=default)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
        )

        if widget_state.value_changed:
            if widget_state.value is not None:
                proto.value = widget_state.value
            proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, None)

        self.dg._enqueue("feedback", proto, layout_config=layout_config)

        return widget_state.value

    @property
    def dg(self) -> DeltaGenerator:
        """Get our DeltaGenerator."""
        return cast("DeltaGenerator", self)
