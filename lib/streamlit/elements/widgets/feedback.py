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

import numbers
from typing import (
    TYPE_CHECKING,
    Final,
    Literal,
    cast,
    overload,
)

from streamlit.elements.lib import agent_spec
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
from streamlit.errors import StreamlitValueError, StreamlitValueOutOfRangeError
from streamlit.proto.Feedback_pb2 import Feedback as FeedbackProto
from streamlit.runtime.metrics_util import gather_metrics
from streamlit.runtime.scriptrunner_utils.script_run_context import get_script_run_ctx
from streamlit.runtime.state import (
    get_session_state,
    register_widget,
    validate_on_change_mode,
)

if TYPE_CHECKING:
    from streamlit.delta_generator import DeltaGenerator
    from streamlit.runtime.state import (
        BindOption,
        OnChangeMode,
        PersistStateOption,
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

    def __init__(self, num_options: int, default_value: int | None = None):
        self.num_options = num_options
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
        value = int(ui_value)  # User selected a value
        # An index outside the options (e.g. ?rating=4 in the URL of a "thumbs"
        # widget) falls back to the default, so a bound URL param is cleared.
        if not 0 <= value < self.num_options:
            return self.default_value
        return value


class FeedbackMixin:
    @overload
    def feedback(
        self,
        options: Literal["thumbs"] = ...,
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | OnChangeMode | None = "rerun",
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> Literal[0, 1] | None: ...

    @overload
    def feedback(
        self,
        options: Literal["faces", "stars"] = ...,
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | OnChangeMode | None = "rerun",
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
    ) -> Literal[0, 1, 2, 3, 4] | None: ...

    @gather_metrics("feedback")
    def feedback(
        self,
        options: Literal["thumbs", "faces", "stars"] = "thumbs",
        *,
        key: Key | None = None,
        default: int | None = None,
        disabled: bool = False,
        on_change: WidgetCallback | OnChangeMode | None = "rerun",
        args: WidgetArgs | None = None,
        kwargs: WidgetKwargs | None = None,
        width: Width = "content",
        bind: BindOption = None,
        persist_state: PersistStateOption = None,
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

        on_change : callable, "rerun", "ignore", or None
            How the feedback widget should respond to value changes. This
            controls whether or not Streamlit reruns the app when the user
            interacts with the feedback widget. ``on_change`` can be one of
            the following:

            - ``"rerun"`` (default): Streamlit will rerun the app when the
              user commits a new value (clicking an option or clearing the
              selection).

            - ``"ignore"``: Streamlit will not rerun the app when the user
              commits a new value. The feedback widget still updates in the
              UI. The new value is available on the next rerun triggered by
              something else, such as another widget interaction. Ignored
              commits are held in the browser and are lost if the page is
              refreshed before that rerun, unless ``bind="query-params"``
              is set (see ``bind``). Inside ``st.form``, this has no
              effect: the form already defers all commits until submit.

            - A ``callable``: Streamlit will rerun the app and execute the
              ``callable`` as a callback function before the rest of the app.

            - ``None``: This is the same as ``on_change="rerun"``. This value
              exists for backwards compatibility and shouldn't be used.

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

        bind : "query-params" or None
            Binding mode for syncing the widget's value with a URL query
            parameter. If this is ``None`` (default), the widget's value
            is not synced to the URL. When this is set to
            ``"query-params"``, changes to the widget update the URL, and
            the widget can be initialized or updated through a query
            parameter in the URL. This requires ``key`` to be set. The
            key is used as the query parameter name.

            The query parameter holds the index of the selected option, the
            same integer the widget returns (e.g., ``?rating=4`` for five
            stars). When the widget's value equals its default, the query
            parameter is removed from the URL to keep it clean. A bound
            query parameter can't be set or deleted through
            ``st.query_params``; it can only be programmatically changed
            through ``st.session_state``.

            An empty query parameter (e.g., ``?rating=``) clears the
            widget. Invalid query parameter values are ignored and removed
            from the URL.

            When ``on_change="ignore"``, Streamlit updates the URL on the
            same commits described above. As with widgets inside a form,
            the URL can show a value that Python hasn't received yet.
            Python receives the new value on the next rerun, so a page load
            or share uses the updated URL value.

        persist_state : "page", "session", or None
            How long to preserve the widget's value when it isn't rendered.
            If this is ``None`` (default), the value is lost when the widget
            stops being rendered or the user switches pages. If this is
            ``"page"``, the value is preserved only while the user stays on the
            page where the widget is defined (for example, while the widget is
            conditionally hidden); it is discarded on a page switch and is not
            restored if the user returns to the page. If this is ``"session"``,
            the value is preserved for the entire session, including across
            page switches, so it returns when the user navigates back. This
            requires ``key`` to be set. If ``bind="query-params"`` is also set,
            the binding takes precedence: the value is stored in the URL, so it
            persists across page switches regardless of the ``persist_state``
            scope.

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
            raise StreamlitValueError("options", ["'thumbs'", "'faces'", "'stars'"])

        num_options = _get_num_options(options)

        if default is not None and not (0 <= default < num_options):
            raise StreamlitValueOutOfRangeError("default", default, 0, num_options - 1)

        key = to_key(key)
        on_change_callback = validate_on_change_mode(
            on_change,
            supported_modes=("rerun", "ignore"),
        )
        layout_config = create_layout_config(width=width, allow_content_width=True)

        check_widget_policies(self.dg, key, on_change_callback, default_value=default)

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

        # Set query param key if bound
        if bind == "query-params" and key is not None:
            proto.query_param_key = str(key)

        if isinstance(on_change, str) and on_change == "ignore":
            proto.ignore_rerun = True

        serde = FeedbackSerde(num_options, default_value=default)

        widget_state = register_widget(
            proto.id,
            on_change_handler=on_change_callback,
            args=args,
            kwargs=kwargs,
            deserializer=serde.deserialize,
            serializer=serde.serialize,
            ctx=ctx,
            value_type="string_value",
            disabled=disabled,
            bind=bind,
            persist_state=persist_state,
            # Choosing the selected option again clears it.
            clearable=True,
        )

        current_value = widget_state.value
        # Reset any value that isn't a valid option index to the default, so the
        # widget never returns an index it doesn't display. register_widget
        # skips the deserializer for a value set through session state or
        # restored by persist_state, such as a persisted 5-star rating restored
        # onto a "thumbs" widget. Any Integral is accepted so NumPy integers
        # work, but bool is rejected although it subclasses int. `stored_value`
        # is typed as `object` so the type checker doesn't flag these checks as
        # unreachable.
        stored_value: object = current_value
        value_needs_reset = stored_value is not None and (
            isinstance(stored_value, bool)
            or not isinstance(stored_value, numbers.Integral)
            or not 0 <= int(stored_value) < num_options
        )
        if value_needs_reset:
            current_value = default
            if key is not None:
                get_session_state().reset_state_value(key, current_value)

        if value_needs_reset or widget_state.value_changed:
            if current_value is not None:
                proto.value = current_value
            proto.set_value = True

        if ctx:
            save_for_app_testing(ctx, element_id, None)

        self.dg._enqueue(
            "feedback",
            proto,
            layout_config=layout_config,
            has_one_shot_effect=value_needs_reset or widget_state.value_changed,
            agent_props=agent_spec.element(
                "feedback",
                key=element_id,
                action="value",
                # Choosing the current option again clears it, for every feedback type.
                clearable=True,
                # The index of the chosen option. `options` names the set.
                value_schema=agent_spec.INTEGER,
                choices=list(range(num_options)),
                options=options,
                disabled=disabled,
                on_change="ignore" if on_change == "ignore" else "rerun",
            ),
        )

        return current_value

    @property
    def dg(self) -> DeltaGenerator:
        """The associated DeltaGenerator."""
        return cast("DeltaGenerator", self)
