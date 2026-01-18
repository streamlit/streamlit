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

from typing import TYPE_CHECKING, Any, TypedDict, cast

from typing_extensions import Self

from streamlit.errors import StreamlitAPIException
from streamlit.logger import get_logger
from streamlit.runtime.scriptrunner import get_script_run_ctx

if TYPE_CHECKING:
    from streamlit.runtime.state import SessionState
    from streamlit.runtime.state.common import WidgetValuePresenter


_LOGGER = get_logger(__name__)


class _TriggerPayload(TypedDict, total=False):
    event: str
    value: object


def make_bidi_component_presenter(
    aggregator_id: str,
    component_id: str | None = None,
    allowed_state_keys: set[str] | None = None,
) -> WidgetValuePresenter:
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
        def _check_modification(k: str) -> None:
            ctx = get_script_run_ctx()
            if ctx is not None and component_id is not None:
                user_key = session_state._key_id_mapper.get_key_from_id(component_id)
                if (
                    component_id in ctx.widget_ids_this_run
                    or user_key in ctx.form_ids_this_run
                ):
                    raise StreamlitAPIException(
                        f"`st.session_state.{user_key}.{k}` cannot be modified after the component"
                        f" with key `{user_key}` is instantiated."
                    )

        # Base state must be a flat mapping; otherwise, present as-is.
        base_map: dict[str, object] | None = None
        if isinstance(base_value, dict):
            base_map = cast("dict[str, object]", base_value)

        if base_map is not None:
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

                # Merge triggers into a flat view: triggers first, then base
                flat: dict[str, object] = dict(event_to_val)
                flat.update(base_map)

                # Return a write-through dict that updates the underlying
                # component state when users assign nested keys via
                # st.session_state[component_user_key][name] = value. Using a
                # dict subclass ensures pretty-printing and JSON serialization
                # behave as expected for st.write and logs.
                class _WriteThrough(dict[str, object]):  # noqa: FURB189
                    def __init__(self, data: dict[str, object]) -> None:
                        super().__init__(data)

                    def __getattr__(self, name: str) -> object:
                        return self.get(name)

                    def __setattr__(self, name: str, value: object) -> None:
                        if name.startswith(("__", "_")):
                            return super().__setattr__(name, value)
                        self[name] = value
                        return None

                    def __deepcopy__(self, memo: dict[int, Any]) -> Self:
                        # This object is a proxy to the real state. Don't copy it.
                        memo[id(self)] = self
                        return self

                    def __setitem__(self, k: str, v: object) -> None:
                        _check_modification(k)

                        if (
                            allowed_state_keys is not None
                            and k not in allowed_state_keys
                        ):
                            # Silently ignore invalid keys to match permissive session_state semantics
                            return

                        # Update the underlying stored base state and this dict
                        super().__setitem__(k, v)
                        try:
                            # Store back to session state's widget store as a flat mapping
                            ss = session_state
                            # Directly set the value in the new widget state store
                            if component_id is not None:
                                ss._new_widget_state.set_from_value(
                                    component_id, dict(self)
                                )
                        except Exception as e:
                            _LOGGER.debug("Failed to persist CCv2 state update: %s", e)

                    def __delitem__(self, k: str) -> None:
                        _check_modification(k)

                        super().__delitem__(k)
                        try:
                            ss = session_state
                            if component_id is not None:
                                ss._new_widget_state.set_from_value(
                                    component_id, dict(self)
                                )
                        except Exception as e:
                            _LOGGER.debug(
                                "Failed to persist CCv2 state deletion: %s", e
                            )

                return _WriteThrough(flat)
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
