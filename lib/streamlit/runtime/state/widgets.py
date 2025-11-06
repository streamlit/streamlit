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

from typing import TYPE_CHECKING

from streamlit.errors import StreamlitAPIException
from streamlit.runtime.state.common import (
    RegisterWidgetResult,
    T,
    ValueFieldName,
    WidgetArgs,
    WidgetCallback,
    WidgetDeserializer,
    WidgetKwargs,
    WidgetMetadata,
    WidgetSerializer,
    WidgetValuePresenter,
    user_key_from_element_id,
)

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner import ScriptRunContext


def register_widget(
    element_id: str,
    *,
    deserializer: WidgetDeserializer[T],
    serializer: WidgetSerializer[T],
    ctx: ScriptRunContext | None,
    callbacks: dict[str, WidgetCallback] | None = None,
    on_change_handler: WidgetCallback | None = None,
    args: WidgetArgs | None = None,
    kwargs: WidgetKwargs | None = None,
    value_type: ValueFieldName,
    presenter: WidgetValuePresenter | None = None,
) -> RegisterWidgetResult[T]:
    """Register a widget with Streamlit, and return its current value.
    NOTE: This function should be called after the proto has been filled.

    Parameters
    ----------
    element_id : str
        The id of the element. Must be unique.
    deserializer : WidgetDeserializer[T]
        Called to convert a widget's protobuf value to the value returned by
        its st.<widget_name> function.
    serializer : WidgetSerializer[T]
        Called to convert a widget's value to its protobuf representation.
    ctx : ScriptRunContext or None
        Used to ensure uniqueness of widget IDs, and to look up widget values.
    callbacks : dict[str, WidgetCallback] or None
        A dictionary of callbacks for multi-callback support.
    on_change_handler : WidgetCallback or None
        An optional callback invoked when the widget's value changes.
    args : WidgetArgs or None
        Positional arguments to pass to the `on_change_handler` or `callbacks`.
    kwargs : WidgetKwargs or None
        Keyword arguments to pass to the `on_change_handler` or `callbacks`.
    value_type: ValueFieldName
        The value_type the widget is going to use.
        We use this information to start with a best-effort guess for the value_type
        of each widget. Once we actually receive a proto for a widget from the
        frontend, the guess is updated to be the correct type. Unfortunately, we're
        not able to always rely on the proto as the type may be needed earlier.
        Thankfully, in these cases (when value_type == "trigger_value"), the static
        table here being slightly inaccurate should never pose a problem.
    presenter : WidgetValuePresenter or None
        An optional hook that allows a widget to customize how its value should be
        presented.


    Returns
    -------
    register_widget_result : RegisterWidgetResult[T]
        Provides information on which value to return to the widget caller,
        and whether the UI needs updating.

        - Unhappy path:
            - Our ScriptRunContext doesn't exist (meaning that we're running
            as a "bare script" outside streamlit).
            - We are disconnected from the SessionState instance.
            In both cases we'll return a fallback RegisterWidgetResult[T].
        - Happy path:
            - The widget has already been registered on a previous run but the
            user hasn't interacted with it on the client. The widget will have
            the default value it was first created with. We then return a
            RegisterWidgetResult[T], containing this value.
            - The widget has already been registered and the user *has*
            interacted with it. The widget will have that most recent
            user-specified value. We then return a RegisterWidgetResult[T],
            containing this value.

        For both paths a widget return value is provided, allowing the widgets
        to be used in a non-streamlit setting.
    """
    if on_change_handler is not None and callbacks is not None:
        raise StreamlitAPIException(
            "Cannot provide both `on_change` and `callbacks` to a widget."
        )

    # Create the widget's updated metadata, and register it with session_state.
    metadata = WidgetMetadata(
        element_id,
        deserializer,
        serializer,
        value_type=value_type,
        callback=on_change_handler,
        callbacks=callbacks,
        callback_args=args,
        callback_kwargs=kwargs,
        fragment_id=ctx.current_fragment_id if ctx else None,
        presenter=presenter,
    )
    return register_widget_from_metadata(metadata, ctx)


def register_widget_from_metadata(
    metadata: WidgetMetadata[T],
    ctx: ScriptRunContext | None,
) -> RegisterWidgetResult[T]:
    """Register a widget and return its value, using an already constructed
    `WidgetMetadata`.

    This is split out from `register_widget` to allow caching code to replay
    widgets by saving and reusing the completed metadata.

    See `register_widget` for details on what this returns.
    """
    if ctx is None:
        # Early-out if we don't have a script run context (which probably means
        # we're running as a "bare" Python script, and not via `streamlit run`).
        return RegisterWidgetResult.failure(deserializer=metadata.deserializer)

    widget_id = metadata.id
    user_key = user_key_from_element_id(widget_id)

    return ctx.session_state.register_widget(metadata, user_key)
