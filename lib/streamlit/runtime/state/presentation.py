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

from typing import TYPE_CHECKING, Any, Final

from streamlit.logger import get_logger

_LOGGER: Final = get_logger(__name__)

if TYPE_CHECKING:
    from streamlit.runtime.state.session_state import SessionState


def apply_presenter(
    session_state: SessionState, widget_id: str, base_value: Any
) -> Any:
    """Return the user-visible value for a widget if it has a ``presenter``.

    If the widget's metadata defines a ``presenter`` callable, it is used to
    transform the stored value into its presentation form. Any exception raised
    while resolving metadata or invoking the presenter is swallowed and
    ``base_value`` is returned, so presentation never interferes with core
    behavior.

    Notes
    -----
    Presentation is applied exclusively for user-facing access paths such as:
    - `st.session_state[... ]` via `SessionState.__getitem__`
    - `SessionState.filtered_state`

    Internal serialization paths (for example `WStates.as_widget_states()` and
    `SessionState.get_widget_states()`) must operate on base (unpresented)
    values to ensure stable and lossless serialization. Do not use
    `apply_presenter` in serialization code paths.

    Parameters
    ----------
    session_state : SessionState
        The current session state object that holds widget state and metadata.
    widget_id : str
        The identifier of the widget whose value is being presented.
    base_value : Any
        The raw value stored for the widget.

    Returns
    -------
    Any
        The value that should be shown to the user.
    """

    try:
        meta = session_state._get_widget_metadata(widget_id)
        presenter = getattr(meta, "presenter", None) if meta is not None else None
        if presenter is None:
            return base_value

        # Ensure the presenter is callable to avoid silently failing on a
        # TypeError when attempting to invoke a non-callable value.
        if not callable(presenter):
            _LOGGER.warning(
                "Widget '%s' has a non-callable presenter (%r); returning base value.",
                widget_id,
                presenter,
            )
            return base_value
        try:
            return presenter(base_value, session_state)
        except Exception:
            return base_value
    except Exception:
        # If metadata is unavailable or any other error occurs, degrade gracefully.
        return base_value
