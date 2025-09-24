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

from typing import TYPE_CHECKING, TypedDict, TypeGuard, cast

from streamlit.logger import get_logger

if TYPE_CHECKING:
    from collections.abc import Mapping

    from streamlit.runtime.state import SessionState
    from streamlit.runtime.state.common import WidgetValuePresenter


_LOGGER = get_logger(__name__)


class _WrappedValue(TypedDict):
    value: Mapping[str, object]


class _TriggerPayload(TypedDict, total=False):
    event: str
    value: object


def make_bidi_component_presenter(aggregator_id: str) -> WidgetValuePresenter:
    """Return a presenter that merges trigger events into CCv2 state.

    This function returns a callable that takes a component's persistent state
    value and the current `SessionState` instance, and returns the user-visible
    value that should appear in `st.session_state`.

    The presenter is side-effect-free and does not mutate stored state or
    callback behavior. It is intended to be attached to the persistent state
    widget via the generic `presenter` hook.

    Parameters
    ----------
    aggregator_id
        The ID of the trigger aggregator widget that holds the event payloads.

    Returns
    -------
    WidgetValuePresenter
        A callable that merges the trigger event values into the component's
        base state for presentation in `st.session_state`.

    """

    def _present(base_value: object, session_state: SessionState) -> object:
        def _is_wrapped_value(obj: object) -> TypeGuard[_WrappedValue]:
            if not isinstance(obj, dict):
                return False

            # The cast is necessary to convince the type checker that key access is safe.
            obj = cast("dict[str, object]", obj)

            if "value" not in obj or len(obj) != 1:
                return False

            return isinstance(obj["value"], dict)

        if _is_wrapped_value(base_value):
            # Read the trigger aggregator payloads if present
            try:
                agg_meta = session_state._new_widget_state.widget_metadata.get(
                    aggregator_id
                )
                if agg_meta is None or agg_meta.value_type != "json_trigger_value":
                    return base_value

                try:
                    agg_payloads_obj = session_state._new_widget_state[aggregator_id]
                except KeyError:
                    agg_payloads_obj = None

                payloads_list: list[_TriggerPayload] | None
                if agg_payloads_obj is None:
                    payloads_list = None
                elif isinstance(agg_payloads_obj, list):
                    # Filter and cast to the expected payload type shape
                    payloads_list = [
                        cast("_TriggerPayload", p)
                        for p in agg_payloads_obj
                        if isinstance(p, dict)
                    ]
                elif isinstance(agg_payloads_obj, dict):
                    payloads_list = [cast("_TriggerPayload", agg_payloads_obj)]
                else:
                    payloads_list = None

                event_to_val: dict[str, object] = {}
                if payloads_list is not None:
                    for payload in payloads_list:
                        ev = payload.get("event")
                        if isinstance(ev, str):
                            event_to_val[ev] = payload.get("value")

                wrapped = cast("_WrappedValue", base_value)  # type: ignore[redundant-cast]
                inner: dict[str, object] = dict(wrapped["value"])  # shallow copy
                inner.update(event_to_val)
                return {"value": inner}
            except Exception as e:
                # On any error, fall back to the base value
                _LOGGER.debug(
                    "Failed to merge trigger events into component state: %s",
                    e,
                    exc_info=e,
                )
                return base_value

        return base_value

    return _present
