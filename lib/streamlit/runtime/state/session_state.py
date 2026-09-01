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

import functools
import json
import pickle  # noqa: S403
from collections.abc import (
    Callable,
    Iterator,
    KeysView,
    Mapping,
    MutableMapping,
    Sequence,
)
from copy import deepcopy
from dataclasses import dataclass, field, replace
from typing import (
    TYPE_CHECKING,
    Any,
    Final,
    Literal,
    TypeAlias,
    cast,
)

from streamlit import config, util
from streamlit.errors import (
    StreamlitWidgetAlreadyInstantiatedError,
    UnserializableSessionStateError,
)
from streamlit.logger import get_logger
from streamlit.proto.WidgetStates_pb2 import WidgetState as WidgetStateProto
from streamlit.proto.WidgetStates_pb2 import WidgetStates as WidgetStatesProto
from streamlit.runtime.runtime_util import (
    WidgetStateSizeError,
    get_max_widget_state_size_bytes,
)
from streamlit.runtime.scriptrunner_utils.script_run_context import (
    RunLocation,
    ScriptRunContext,
    ThreadState,
    get_script_run_ctx,
)
from streamlit.runtime.state.common import (
    RegisterWidgetResult,
    T,
    ValueFieldName,
    WidgetArgs,
    WidgetCallback,
    WidgetMetadata,
    is_array_value_field_name,
    is_element_id,
    is_keyed_element_id,
)
from streamlit.runtime.state.presentation import apply_presenter
from streamlit.runtime.state.query_params import (
    QueryParams,
    is_empty_url_value,
    parse_url_param,
)
from streamlit.runtime.stats import (
    CACHE_MEMORY_FAMILY,
    CacheStat,
    StatsProvider,
    group_cache_stats,
)

_LOGGER: Final = get_logger(__name__)

if TYPE_CHECKING:
    from streamlit.runtime.scriptrunner import RerunData
    from streamlit.runtime.session_manager import SessionManager


STREAMLIT_INTERNAL_KEY_PREFIX: Final = "$$STREAMLIT_INTERNAL_KEY"
SCRIPT_RUN_WITHOUT_ERRORS_KEY: Final = (
    f"{STREAMLIT_INTERNAL_KEY_PREFIX}_SCRIPT_RUN_WITHOUT_ERRORS"
)

_TRIGGER_PROTO_FIELDS: Final = frozenset(
    {
        "trigger_value",
        "string_trigger_value",
        "chat_input_value",
        "json_trigger_value",
    }
)


def _sanitize_url_array(
    parsed: list[str],
    *,
    valid_options: list[str] | None,
    max_length: int | None,
    allow_duplicates: bool = False,
) -> list[str] | None:
    """Sanitize a URL-parsed string array by filtering invalid values,
    optionally removing duplicates, and enforcing a maximum length.

    Returns the sanitized list if any changes were made, or None if the
    input required no sanitization.
    """
    result = parsed

    # Remove values not in the valid options list.
    if valid_options is not None:
        result = [v for v in result if v in valid_options]

    # Deduplicate while preserving order. Skipped when allow_duplicates is
    # True (e.g., select_slider range mode where ?color=red&color=red is a
    # valid zero-width range).
    if not allow_duplicates:
        seen: set[str] = set()
        deduped: list[str] = []
        for v in result:
            if v not in seen:
                seen.add(v)
                deduped.append(v)
        if len(deduped) < len(result):
            result = deduped

    # Truncate to max_length (e.g. multiselect max_selections).
    if max_length is not None and max_length > 0 and len(result) > max_length:
        result = result[:max_length]

    return result if result != parsed else None


@dataclass(frozen=True, slots=True)
class Serialized:
    """A widget value that's serialized to a protobuf. Immutable."""

    value: WidgetStateProto


@dataclass(frozen=True, slots=True)
class Value:
    """A widget value that's not serialized. Immutable."""

    value: Any


WState: TypeAlias = Value | Serialized


@dataclass(slots=True)
class WStates(MutableMapping[str, Any]):
    """A mapping of widget IDs to values. Widget values can be stored in
    serialized or deserialized form, but when values are retrieved from the
    mapping, they'll always be deserialized.
    """

    states: dict[str, WState] = field(default_factory=dict)
    widget_metadata: dict[str, WidgetMetadata[Any]] = field(default_factory=dict)

    def __repr__(self) -> str:
        return util.repr_(self)

    def __getitem__(self, k: str) -> Any:
        """Return the value of the widget with the given key.
        If the widget's value is currently stored in serialized form, it
        will be deserialized first.
        """
        wstate = self.states.get(k)
        if wstate is None:
            raise KeyError(k)

        if isinstance(wstate, Value):
            # The widget's value is already deserialized - return it directly.
            return wstate.value

        # The widget's value is serialized. We deserialize it, and return
        # the deserialized value.

        metadata = self.widget_metadata.get(k)
        if metadata is None:
            # No deserializer, which should only happen if state is
            # gotten from a reconnecting browser and the script is
            # trying to access it. Pretend it doesn't exist.
            raise KeyError(k)
        value_field_name = cast(
            "ValueFieldName",
            wstate.value.WhichOneof("value"),
        )
        value = (
            wstate.value.__getattribute__(value_field_name)
            if value_field_name  # Field name is None if the widget value was cleared
            else None
        )

        if is_array_value_field_name(value_field_name):
            # Array types are messages with data in a `data` field
            value = value.data
        elif value_field_name == "json_value":
            value = json.loads(cast("str", value))
        elif value_field_name == "string_trigger_value":
            # StringTriggerValue is a message with data in a `data` field
            value = value.data

        deserialized = metadata.deserializer(value)

        # Update metadata to reflect information from WidgetState proto
        self.set_widget_metadata(
            replace(
                metadata,
                value_type=value_field_name,
            )
        )

        self.states[k] = Value(deserialized)
        return deserialized

    def __setitem__(self, k: str, v: WState) -> None:
        self.states[k] = v

    def __delitem__(self, k: str) -> None:
        del self.states[k]

    def __len__(self) -> int:
        return len(self.states)

    def __iter__(self) -> Iterator[str]:
        # For this and many other methods, we can't simply delegate to the
        # states field, because we need to invoke `__getitem__` for any
        # values, to handle deserialization and unwrapping of values.
        yield from self.states

    def keys(self) -> KeysView[str]:
        return KeysView(self.states)

    def items(self) -> set[tuple[str, Any]]:  # type: ignore[override] # ty: ignore[invalid-method-override]
        return {(k, self[k]) for k in self}

    def values(self) -> set[Any]:  # type: ignore[override] # ty: ignore[invalid-method-override]
        return {self[wid] for wid in self}

    def update(self, other: WStates) -> None:  # type: ignore[override] # ty: ignore[invalid-method-override]
        """Copy all widget values and metadata from 'other' into this mapping,
        overwriting any data in this mapping that's also present in 'other'.
        """
        self.states.update(other.states)
        self.widget_metadata.update(other.widget_metadata)

    def set_widget_from_proto(self, widget_state: WidgetStateProto) -> None:
        """Set a widget's serialized value, overwriting any existing value it has."""
        self[widget_state.id] = Serialized(widget_state)

    def set_from_value(self, k: str, v: Any) -> None:
        """Set a widget's deserialized value, overwriting any existing value it has."""
        self[k] = Value(v)

    def set_widget_metadata(self, widget_meta: WidgetMetadata[Any]) -> None:
        """Set a widget's metadata, overwriting any existing metadata it has."""
        self.widget_metadata[widget_meta.id] = widget_meta

    def remove_stale_widgets(
        self,
        active_widget_ids: frozenset[str],
        fragment_ids_this_run: list[str] | None,
    ) -> None:
        """Remove widget state for stale widgets."""
        self.states = {
            k: v
            for k, v in self.states.items()
            if not _is_stale_widget(
                self.widget_metadata.get(k),
                active_widget_ids,
                fragment_ids_this_run,
            )
        }

    def get_serialized(self, k: str) -> WidgetStateProto | None:
        """Get the serialized value of the widget with the given id.

        If the widget doesn't exist, return None. If the widget exists but
        is not in serialized form, it will be serialized first.
        """

        item = self.states.get(k)
        if item is None:
            # No such widget: return None.
            return None

        if isinstance(item, Serialized):
            # Widget value is serialized: return it directly.
            return item.value

        # Widget value is not serialized: serialize it first!
        metadata = self.widget_metadata.get(k)
        if metadata is None:
            # We're missing the widget's metadata. (Can this happen?)
            return None

        widget = WidgetStateProto()
        widget.id = k

        field = metadata.value_type
        serialized = metadata.serializer(item.value)

        if is_array_value_field_name(field):
            arr = getattr(widget, field)
            arr.data.extend(serialized)
        elif field in {"json_value", "json_trigger_value"}:
            setattr(widget, field, json.dumps(serialized))
        elif field == "file_uploader_state_value":
            widget.file_uploader_state_value.CopyFrom(serialized)
        elif field == "string_trigger_value":
            widget.string_trigger_value.CopyFrom(serialized)
        elif field == "chat_input_value":
            widget.chat_input_value.CopyFrom(serialized)
        elif field is not None and serialized is not None:
            # If the field is None, the widget value was cleared
            # by the user and therefore is None. But we cannot
            # set it to None here, since the proto properties are
            # not nullable. So we just don't set it.
            setattr(widget, field, serialized)

        return widget

    def as_widget_states(self) -> list[WidgetStateProto]:
        """Return a list of serialized widget values for each widget with a value."""
        return [
            s
            for widget_id in self.states
            if (s := self.get_serialized(widget_id)) is not None
        ]

    def call_callback(self, widget_id: str) -> None:
        """Call the given widget's callback and return the callback's
        return value. If the widget has no callback, return None.

        If the widget doesn't exist, raise an Exception.
        """
        metadata = self.widget_metadata.get(widget_id)

        if metadata is None:
            raise RuntimeError(f"Widget {widget_id} not found.")

        callback = metadata.callback
        if callback is None:
            return

        args = metadata.callback_args or ()
        kwargs = metadata.callback_kwargs or {}

        with ThreadState.scoped(
            run_location=RunLocation.CALLBACK,
            fragment_id=metadata.fragment_id,
        ):
            callback(*args, **kwargs)


def _missing_key_error_message(key: str) -> str:
    return (
        f'st.session_state has no key "{key}". Did you forget to initialize it? '
        f"More info: https://docs.streamlit.io/develop/concepts/architecture/session-state#initialization"
    )


@dataclass(slots=True)
class KeyIdMapper:
    """A mapping of user-provided keys to element IDs.
    It also maps element IDs to user-provided keys so that this reverse mapping
    does not have to be computed ad-hoc.
    All built-in dict-operations such as setting and deleting expect the key as the
    argument, not the element ID.
    """

    _key_id_mapping: dict[str, str] = field(default_factory=dict)
    _id_key_mapping: dict[str, str] = field(default_factory=dict)

    def __contains__(self, key: str) -> bool:
        return key in self._key_id_mapping

    def __setitem__(self, key: str, widget_id: Any) -> None:
        self._key_id_mapping[key] = widget_id
        self._id_key_mapping[widget_id] = key

    def __delitem__(self, key: str) -> None:
        self.delete(key)

    @property
    def id_key_mapping(self) -> dict[str, str]:
        return self._id_key_mapping

    def set_key_id_mapping(self, key_id_mapping: dict[str, str]) -> None:
        self._key_id_mapping = key_id_mapping
        self._id_key_mapping = {v: k for k, v in key_id_mapping.items()}

    def get_id_from_key(self, key: str, default: str | None = None) -> str | None:
        return self._key_id_mapping.get(key, default)

    def get_key_from_id(self, widget_id: str) -> str:
        return self._id_key_mapping[widget_id]

    def update(self, other: KeyIdMapper) -> None:
        self._key_id_mapping.update(other._key_id_mapping)
        self._id_key_mapping.update(other._id_key_mapping)

    def clear(self) -> None:
        self._key_id_mapping.clear()
        self._id_key_mapping.clear()

    def delete(self, key: str) -> None:
        widget_id = self._key_id_mapping[key]
        del self._key_id_mapping[key]
        del self._id_key_mapping[widget_id]


@dataclass(slots=True)
class PersistedWidgetTracker:
    """Tracks persist_state bookkeeping for keyed widgets.

    "session" scope always preserves a widget's value when it stops rendering.
    "page" scope preserves it only while the user stays on the widget's page, and
    drops it on a page switch — including telling a remounted widget to ignore a
    value the frontend may resend for the reused id.

    The tracker only records policy; SessionState performs the actual value
    mutations. bind="query-params" takes precedence over "page" scope: the
    tracker is unaware of it, and the caller passes ``is_bound`` so bound widgets
    skip the drops.
    """

    # Widget id -> scope it registered with. A durable snapshot that survives the
    # rerun sequencing of a page transition.
    _scopes: dict[str, Literal["page", "session"]] = field(default_factory=dict)
    # "page" widget id -> page hash where it last registered.
    _widget_pages: dict[str, str] = field(default_factory=dict)
    # "page" user key -> origin page hash of a value preserved while unmounted.
    _value_pages: dict[str, str] = field(default_factory=dict)
    # "page" widget ids whose value was dropped on a page switch; the next
    # registration must discard a frontend-resent value and reset to the default.
    _pending_resets: set[str] = field(default_factory=set)

    def clear(self) -> None:
        self._scopes.clear()
        self._widget_pages.clear()
        self._value_pages.clear()
        self._pending_resets.clear()

    # --- Reads (also used by white-box tests) ------------------------------

    def scope_of(self, widget_id: str) -> Literal["page", "session"] | None:
        return self._scopes.get(widget_id)

    def page_of(self, widget_id: str) -> str | None:
        return self._widget_pages.get(widget_id)

    def value_page_of(self, user_key: str) -> str | None:
        return self._value_pages.get(user_key)

    def has_pending_reset(self, widget_id: str) -> bool:
        return widget_id in self._pending_resets

    def should_preserve(self, widget_id: str, current_page: str) -> bool:
        """True if a stale keyed widget's value should be carried forward."""
        scope = self._scopes.get(widget_id)
        if scope == "session":
            return True
        if scope == "page":
            return self._widget_pages.get(widget_id) == current_page
        return False

    # --- Stale-cleanup hooks -----------------------------------------------

    def note_preserved_value(
        self, widget_id: str, user_key: str, current_page: str
    ) -> None:
        """Record (or clear) the origin page for a value carried forward while
        its widget is unmounted, so a later registration on a different page can
        drop it instead of adopting it.
        """
        if self._scopes.get(widget_id) == "page":
            self._value_pages[user_key] = self._widget_pages.get(
                widget_id, current_page
            )
        else:
            self._value_pages.pop(user_key, None)

    def mark_page_switch_drops(
        self,
        current_page: str,
        user_key_for: Mapping[str, str],
        is_exempt: Callable[[str], bool],
        is_stale: Callable[[str], bool],
    ) -> list[str]:
        """Flag "page"-scoped widgets being dropped on this page switch and
        return the user keys whose preserved value the caller should drop.

        A widget qualifies when its owning page differs from the current one and
        it is stale this run. Flagging it makes its next registration discard a
        value the frontend may resend for the reused id. ``is_exempt`` skips
        widgets that must survive the switch (bound widgets, which take
        precedence over "page" scope); ``is_stale`` reports whether a widget is
        absent from the current run.
        """
        dropped_user_keys: list[str] = []
        for wid, scope in self._scopes.items():
            if scope != "page" or self._widget_pages.get(wid) == current_page:
                continue
            if is_exempt(wid) or not is_stale(wid):
                continue
            self._pending_resets.add(wid)
            user_key = user_key_for.get(wid)
            if user_key is not None:
                dropped_user_keys.append(user_key)
        return dropped_user_keys

    def prune(
        self, live_widget_ids: KeysView[str], live_value_keys: Mapping[str, Any]
    ) -> None:
        """Drop tracking for widgets/keys no longer present, preventing unbounded
        growth across long sessions.
        """
        self._scopes = {w: s for w, s in self._scopes.items() if w in live_widget_ids}
        self._widget_pages = {
            w: p for w, p in self._widget_pages.items() if w in live_widget_ids
        }
        # Origin-page records are kept only while their value is still preserved
        # under the user key in old state.
        self._value_pages = {
            k: p for k, p in self._value_pages.items() if k in live_value_keys
        }
        self._pending_resets.intersection_update(live_widget_ids)

    # --- Registration ------------------------------------------------------

    def register(
        self,
        widget_id: str,
        user_key: str,
        scope: Literal["page", "session"],
        current_page: str,
    ) -> None:
        """Record a persist_state registration: the widget's scope and, for
        "page" scope, the page it is mounting on. This is the durable snapshot
        that later runs read; "session" scope needs no page, so any stale
        page-tracking for the widget is cleared.
        """
        self._scopes[widget_id] = scope
        if scope == "page":
            self._widget_pages[widget_id] = current_page
        else:
            self._widget_pages.pop(widget_id, None)
            self._value_pages.pop(user_key, None)
            self._pending_resets.discard(widget_id)

    def take_pending_drop(
        self, widget_id: str, user_key: str, current_page: str, is_bound: bool
    ) -> bool:
        """Resolve whether a just-registered widget's stored value must be
        dropped, consuming the one-shot flags behind the decision. Call after
        register().

        Returns True when a "page"-scoped value must not survive: it belongs to a
        different page than the one the widget is mounting on, or it was flagged
        for reset after a page switch. Bound widgets are exempt (bind takes
        precedence over "page" scope) but still clear the flags so they don't
        linger. "session" scope never drops.
        """
        if self._scopes.get(widget_id) != "page":
            return False

        should_drop = False
        # A preserved "page" value carries its origin page; drop it if the widget
        # now mounts on a different page so it cannot leak across pages.
        origin_page = self._value_pages.pop(user_key, None)
        if not is_bound and origin_page is not None and origin_page != current_page:
            should_drop = True
        # The value was dropped on a page switch while this page skipped the
        # widget: discard whatever the frontend resends so it falls back to the
        # default, even back on the origin page.
        if widget_id in self._pending_resets:
            self._pending_resets.discard(widget_id)
            if not is_bound:
                should_drop = True
        return should_drop

    def untrack(self, widget_id: str, user_key: str) -> None:
        """Forget all tracking for a widget that stopped persisting."""
        self._scopes.pop(widget_id, None)
        self._widget_pages.pop(widget_id, None)
        self._value_pages.pop(user_key, None)
        self._pending_resets.discard(widget_id)


def _interaction_default_is_app_wide(ctx: ScriptRunContext | None) -> bool:
    """Whether the interaction's default rerun covers the whole app, not one fragment.

    A fragment is running (``ctx.fragment_ids_this_run`` is non-empty) exactly when the
    interacting widget lives inside it, and such a widget defaults to rerunning only
    that fragment. With no context, assume app-wide.
    """
    return not (ctx and ctx.fragment_ids_this_run)


def _navigation_is_pending(
    pending_reruns: list[RerunData], ctx: ScriptRunContext | None
) -> bool:
    """Whether any pending request runs a page other than the one running now.

    Only ``st.switch_page()`` builds such a request from a callback. With no context
    there is no current page to compare against, so nothing counts as navigation.
    """
    return ctx is not None and any(
        rerun_data.page_script_hash != ctx.page_script_hash
        for rerun_data in pending_reruns
    )


@dataclass(slots=True)
class _CallbackRerunVotes:
    """What the callbacks of one interaction asked for, collected during dispatch.

    ``SessionState._call_callbacks`` reads this once every callback has run, to queue
    the requests and decide the interaction's rerun scope.
    """

    # A callback requested specific fragment targets (non-empty fragment_id_queue),
    # whether via scope="fragment" or a keyed scope like scope="charts".
    requested_targeted: bool = False
    # A callback explicitly expects the interaction's default rerun: it returned
    # normally or called plain st.rerun().
    wants_interaction_default: bool = False
    # Requests raised by st.rerun(), in call order, held until the last callback returns.
    pending_reruns: list[RerunData] = field(default_factory=list)


@dataclass(slots=True)
class SessionState:
    """SessionState allows users to store values that persist between app
    reruns.

    Example
    -------
    >>> if "num_script_runs" not in st.session_state:
    ...     st.session_state.num_script_runs = 0
    >>> st.session_state.num_script_runs += 1
    >>> st.write(st.session_state.num_script_runs)  # writes 1

    The next time your script runs, the value of
    st.session_state.num_script_runs will be preserved.
    >>> st.session_state.num_script_runs += 1
    >>> st.write(st.session_state.num_script_runs)  # writes 2
    """

    # All the values from previous script runs, squished together to save memory
    _old_state: dict[str, Any] = field(default_factory=dict)

    # Values set in session state during the current script run, possibly for
    # setting a widget's value. Keyed by a user provided string.
    _new_session_state: dict[str, Any] = field(default_factory=dict)

    # Widget values from the frontend, usually one changing prompted the script rerun
    _new_widget_state: WStates = field(default_factory=WStates)

    # Keys used for widgets will be eagerly converted to the matching element id
    _key_id_mapper: KeyIdMapper = field(default_factory=KeyIdMapper)

    # query params are stored in session state because query params will be tied with
    # widget state at one point.
    query_params: QueryParams = field(default_factory=QueryParams)

    # Widget IDs that have registered with bind="query-params". This is a
    # durable bound-intent snapshot that survives MPA page-transition
    # sequencing where bindings and current-run metadata may already be gone by
    # stale-widget cleanup time.
    _query_param_bound_widget_ids: set[str] = field(default_factory=set)

    # All persist_state bookkeeping (both scopes) lives here. Like
    # _query_param_bound_widget_ids, it is a durable snapshot that survives the
    # rerun sequencing of a page transition.
    _persist_tracker: PersistedWidgetTracker = field(
        default_factory=PersistedWidgetTracker
    )

    # The widget_states proto for the current interaction.
    # on_script_will_rerun stashes this so _request_full_app_rerun can forward
    # the values (including triggers) in its follow-up rerun.  Without the
    # stash the proto would be a local variable unreachable by the time the
    # escalation fires.  Cleared after callbacks finish or when
    # suppress_callbacks skips dispatch.
    _current_interaction_widget_states: WidgetStatesProto | None = field(
        default=None, repr=False
    )

    def __repr__(self) -> str:
        return util.repr_(self)

    # is it possible for a value to get through this without being deserialized?
    def _compact_state(self) -> None:
        """Copy all current session_state and widget_state values into our
        _old_state dict, and then clear our current session_state and
        widget_state.
        """
        for key_or_wid in self:
            try:
                self._old_state[key_or_wid] = self[key_or_wid]
            except KeyError:  # noqa: PERF203
                # handle key errors from widget state not having metadata gracefully
                # https://github.com/streamlit/streamlit/issues/7206
                pass
        self._new_session_state.clear()
        self._new_widget_state.clear()

    def clear(self) -> None:
        """Reset self completely, clearing all current and old values."""
        self._old_state.clear()
        self._new_session_state.clear()
        self._new_widget_state.clear()
        self._key_id_mapper.clear()
        self._query_param_bound_widget_ids.clear()
        self._persist_tracker.clear()

    @property
    def filtered_state(self) -> dict[str, Any]:
        """The combined session and widget state, excluding keyless widgets and internal widgets."""

        wid_key_map = self._key_id_mapper.id_key_mapping

        state: dict[str, Any] = {}

        # We can't write `for k, v in self.items()` here because doing so will
        # run into a `KeyError` if widget metadata has been cleared (which
        # happens when the streamlit server restarted or the cache was cleared),
        # then we receive a widget's state from a browser.
        for k in self._keys():
            if not is_element_id(k) and not _is_internal_key(k):
                state[k] = self[k]
            elif is_keyed_element_id(k) and not _is_internal_key(k):
                try:
                    key = wid_key_map[k]
                    # Value returned by __getitem__ is already presented.
                    state[key] = self[k]
                except KeyError:
                    # Widget id no longer maps to a key, it is a not yet
                    # cleared value in old state for a reset widget
                    pass

        return state

    def _keys(self) -> set[str]:
        """All keys active in Session State, with widget keys converted
        to widget ids when one is known. (This includes autogenerated keys
        for widgets that don't have user_keys defined, and which aren't
        exposed to user code).
        """
        old_keys = {self._get_widget_id(k) for k in self._old_state}
        new_widget_keys = set(self._new_widget_state.keys())
        new_session_state_keys = {
            self._get_widget_id(k) for k in self._new_session_state
        }
        return old_keys | new_widget_keys | new_session_state_keys

    def is_new_state_value(self, user_key: str) -> bool:
        """True if a value with the given key is in the current session state."""
        return user_key in self._new_session_state

    def reset_state_value(self, user_key: str, value: Any | None) -> None:
        """Reset a new session state value to a given value
        without triggering the "state value cannot be modified" error.
        """
        self._new_session_state[user_key] = value

    def __iter__(self) -> Iterator[Any]:
        """Return an iterator over the keys of the SessionState.
        This is a shortcut for `iter(self.keys())`.
        """
        return iter(self._keys())

    def __len__(self) -> int:
        """Return the number of items in SessionState."""
        return len(self._keys())

    def __getitem__(self, key: str) -> Any:
        wid_key_map = self._key_id_mapper.id_key_mapping
        widget_id = self._get_widget_id(key)

        if widget_id in wid_key_map and widget_id == key:
            # the "key" is a raw widget id, so get its associated user key for lookup
            key = wid_key_map[widget_id]
        try:
            base_value = self._getitem(widget_id, key)
            return (
                apply_presenter(self, widget_id, base_value)
                if widget_id is not None
                else base_value
            )
        except KeyError:
            raise KeyError(_missing_key_error_message(key))

    def _getitem(self, widget_id: str | None, user_key: str | None) -> Any:
        """Get the value of an entry in Session State, using either the
        user-provided key or a widget id as appropriate for the internal dict
        being accessed.

        At least one of the arguments must have a value.
        """
        if user_key is None and widget_id is None:  # pragma: no cover - defensive
            raise ValueError(
                "user_key and widget_id cannot both be None. This should never happen."
            )

        if user_key is not None:
            try:
                return self._new_session_state[user_key]
            except KeyError:
                pass

        if widget_id is not None:
            try:
                return self._new_widget_state[widget_id]
            except KeyError:
                pass

        # Typically, there won't be both a widget id and an associated state key in
        # old state at the same time, so the order we check is arbitrary.
        # The exception is if session state is set and then a later run has
        # a widget created, so the widget id entry should be newer.
        # The opposite case shouldn't happen, because setting the value of a widget
        # through session state will result in the next widget state reflecting that
        # value.
        if widget_id is not None:
            try:
                return self._old_state[widget_id]
            except KeyError:
                pass

        if user_key is not None:
            try:
                return self._old_state[user_key]
            except KeyError:
                pass

        # We'll never get here
        raise KeyError

    def __setitem__(self, user_key: str, value: Any) -> None:
        """Set the value of the session_state entry with the given user_key.

        If the key corresponds to a widget or form that's been instantiated
        during the current script run, raise a StreamlitWidgetAlreadyInstantiatedError
        instead.
        """
        ctx = get_script_run_ctx()

        if ctx is not None:
            widget_id = self._key_id_mapper.get_id_from_key(user_key, None)
            widget_ids = ctx.shared.widget_ids_this_run
            form_ids = ctx.shared.form_ids_this_run

            if widget_id in widget_ids or user_key in form_ids:
                raise StreamlitWidgetAlreadyInstantiatedError(user_key)

        self._new_session_state[user_key] = value

    def __delitem__(self, key: str) -> None:
        widget_id = self._get_widget_id(key)

        if not (key in self or widget_id in self):
            raise KeyError(_missing_key_error_message(key))

        if key in self._new_session_state:
            del self._new_session_state[key]

        if key in self._old_state:
            del self._old_state[key]

        if key in self._key_id_mapper:
            self._key_id_mapper.delete(key)

        if widget_id in self._new_widget_state:
            del self._new_widget_state[widget_id]

        if widget_id in self._old_state:
            del self._old_state[widget_id]

    def set_widgets_from_proto(self, widget_states: WidgetStatesProto) -> None:
        """Set the value of all widgets represented in the given WidgetStatesProto."""
        widget_states_size = widget_states.ByteSize()
        if widget_states_size > get_max_widget_state_size_bytes():
            raise WidgetStateSizeError(widget_states_size)

        for state in widget_states.widgets:
            self._new_widget_state.set_widget_from_proto(state)

    def on_script_will_rerun(
        self,
        latest_widget_states: WidgetStatesProto,
        *,
        suppress_callbacks: bool = False,
    ) -> None:
        """Called by ScriptRunner before its script re-runs.

        Update widget data and call callbacks on widgets whose value changed
        between the previous and current script runs.

        Parameters
        ----------
        suppress_callbacks
            When True, apply widget values but skip callback dispatch.
            Set on the full-app rerun queued by ``_request_full_app_rerun``
            after callbacks have already run in this interaction.
        """
        self._reset_triggers()
        self._compact_state()
        self.set_widgets_from_proto(latest_widget_states)
        if suppress_callbacks:
            return
        self._current_interaction_widget_states = latest_widget_states
        try:
            self._call_callbacks()
        finally:
            self._current_interaction_widget_states = None

    def _call_callbacks(self) -> None:
        """Call callbacks for widgets whose value changed or whose trigger fired,
        then queue the reruns they asked for.
        """
        votes = _CallbackRerunVotes()

        # Skip callbacks for disabled widgets: a reported change can only come
        # from a stale UI or a forged message. Callbacks run before widgets
        # re-register, so the metadata read here is from the previous run. That
        # is safe regardless of whether `disabled` is part of the widget id:
        # for most widgets the id excludes `disabled` (so the id is stable and
        # only the enabled<->disabled edges are ambiguous, an intentional
        # trade-off), while for widgets that encode `disabled` in the id (e.g.
        # st.popover) each id has a fixed `disabled` and is thus stable by
        # construction. Either way, a disabled widget's forged change is
        # suppressed.

        # Changed widgets, split by which dispatch path (if any) will handle them.
        changed_widget_ids_for_single_callback: list[str] = []

        for wid in self._new_widget_state:
            if not self._widget_changed(wid):
                continue
            metadata = self._new_widget_state.widget_metadata.get(wid)
            if metadata is None or metadata.disabled:
                continue
            if metadata.callback is not None:
                changed_widget_ids_for_single_callback.append(wid)
            # Widgets with neither `callback` nor `callbacks` (e.g. form fields)
            # are skipped: their values are already in session state and they do
            # not influence rerun scope.  Widgets with `callbacks` are handled by
            # Path 2 below.

        # Path 1: single callback.
        for wid in changed_widget_ids_for_single_callback:
            self._run_callback_and_record_rerun(
                votes,
                functools.partial(self._new_widget_state.call_callback, wid),
            )

        # Path 2: multiple callbacks.
        widget_ids_to_process = list(self._new_widget_state.states.keys())

        for wid in widget_ids_to_process:
            metadata = self._new_widget_state.widget_metadata.get(wid)
            if metadata is None or metadata.callbacks is None or metadata.disabled:
                continue

            args = metadata.callback_args or ()
            kwargs = metadata.callback_kwargs or {}

            # 1) Trigger dispatch: bool + JSON trigger aggregator
            self._dispatch_trigger_callbacks(votes, wid, metadata, args, kwargs)

            # 2) JSON value change dispatch
            if metadata.value_type == "json_value":
                self._dispatch_json_change_callbacks(votes, wid, metadata, args, kwargs)

        ctx = get_script_run_ctx()

        # Queue the callbacks' reruns only now that every callback has run. Queued
        # mid-dispatch, the next callback's first st.* call would pick the request up
        # at a yield point and raise; _run_callback_and_record_rerun cannot tell that
        # from the callback's own st.rerun(), so it would swallow it and that callback
        # would die.
        #
        # No try/finally: if a callback raised, the interaction errored and queueing a
        # rerun anyway would clear the exception element on the next SCRIPT_STARTED.
        if ctx and ctx.script_requests:
            # Queue a navigating request last: request_rerun takes page_script_hash
            # (and query_string) from the newest request, so an st.rerun() coalesced
            # after an st.switch_page() would point the rerun back at the page the
            # user asked to leave.
            current_page = ctx.page_script_hash
            for rerun_data in sorted(
                votes.pending_reruns,
                key=lambda data: data.page_script_hash != current_page,
            ):
                ctx.script_requests.request_rerun(rerun_data)

        if (
            votes.requested_targeted
            and votes.wants_interaction_default
            and _interaction_default_is_app_wide(ctx)
            and not _navigation_is_pending(votes.pending_reruns, ctx)
        ):
            # An app-wide default trumps the targeted requests, so queue it explicitly:
            # the callbacks that returned normally raised nothing, so no request in
            # pending_reruns stands for them, and this run's body is about to be
            # preempted before it can serve as their rerun.
            #
            # A pending navigation already reruns the whole app, so this request would
            # add nothing but its own page — the one being navigated away from.
            self._request_full_app_rerun()

    def _execute_widget_callback(
        self,
        votes: _CallbackRerunVotes,
        callback_fn: WidgetCallback,
        cb_metadata: WidgetMetadata[Any],
        cb_args: WidgetArgs,
        cb_kwargs: dict[str, Any],
    ) -> None:
        """Run a widget callback with ``run_location=CALLBACK`` and the widget's ``fragment_id``."""

        def run() -> None:
            with ThreadState.scoped(
                run_location=RunLocation.CALLBACK,
                fragment_id=cb_metadata.fragment_id,
            ):
                callback_fn(*cb_args, **cb_kwargs)

        self._run_callback_and_record_rerun(votes, run)

    def _run_callback_and_record_rerun(
        self, votes: _CallbackRerunVotes, run: Callable[[], None]
    ) -> None:
        """Run one widget callback and record what it asked for on ``votes``.

        ``st.rerun()`` interrupts the callback with a ``RerunException``. Every such
        request lands in ``votes.pending_reruns``, which ``_call_callbacks`` queues once
        the last callback has run (see the comment there for why it waits), and the
        callback's rerun scope is recorded as:

        - a targeted rerun (non-empty ``fragment_id_queue``) → ``requested_targeted``
        - a plain ``st.rerun()``, or a normal return → ``wants_interaction_default``
        """
        from streamlit.runtime.scriptrunner import RerunException

        try:
            run()
        except RerunException as e:
            rerun_data = e.rerun_data
            if rerun_data.fragment_id_queue:
                votes.requested_targeted = True
            else:
                votes.wants_interaction_default = True
            votes.pending_reruns.append(rerun_data)
        else:
            votes.wants_interaction_default = True

    def _request_full_app_rerun(self) -> None:
        """Queue a full-app rerun that replays trigger values without re-firing callbacks.

        Called when a normally-returning callback's default vote coexists with
        a targeted rerun in a main-script interaction. Only trigger widget
        states are forwarded — non-trigger values already live in session state
        from callback execution. Replaying the full proto would overwrite any
        mutations callbacks made via ``st.session_state["key"] = new_value``.
        """
        from streamlit.runtime.scriptrunner import RerunData

        ctx = get_script_run_ctx()
        if ctx and ctx.script_requests:
            trigger_only_states = self._filter_trigger_widget_states(
                self._current_interaction_widget_states
            )
            ctx.script_requests.request_rerun(
                RerunData(
                    query_string=ctx.query_string,
                    page_script_hash=ctx.page_script_hash,
                    widget_states=trigger_only_states,
                    suppress_callbacks=True,
                    cached_message_hashes=ctx.cached_message_hashes,
                    context_info=ctx.context_info,
                )
            )

    def _filter_trigger_widget_states(
        self, widget_states: WidgetStatesProto | None
    ) -> WidgetStatesProto | None:
        """Return a new WidgetStatesProto containing only trigger-type entries.

        Trigger widgets have ephemeral values that reset after each run, so
        they must be replayed for the script body to observe them. Non-trigger
        values persist in session state and replaying them would overwrite
        any callback mutations.
        """
        if widget_states is None:
            return None

        filtered = WidgetStatesProto()
        for widget in widget_states.widgets:
            if widget.WhichOneof("value") in _TRIGGER_PROTO_FIELDS:
                filtered.widgets.append(widget)
        return filtered if filtered.widgets else None

    def _dispatch_trigger_callbacks(
        self,
        votes: _CallbackRerunVotes,
        wid: str,
        metadata: WidgetMetadata[Any],
        args: WidgetArgs,
        kwargs: dict[str, Any],
    ) -> None:
        """Dispatch trigger-style callbacks for a widget.

        Handles the JSON trigger aggregator. The JSON payload may be a single
        event dict or a list of event dicts; each event must contain an
        ``"event"`` field that maps to the corresponding callback name in
        ``metadata.callbacks``.

        Parameters
        ----------
        votes : _CallbackRerunVotes
            Accumulator that each dispatched callback records its rerun request on.
        wid : str
            The widget ID.
        metadata : WidgetMetadata[Any]
            Metadata for the widget, including registered callbacks.
        args : WidgetArgs
            Positional arguments forwarded to the callback.
        kwargs : dict[str, Any]
            Keyword arguments forwarded to the callback.

        Examples
        --------
        A component with a "submit" callback:

        >>> metadata.callbacks = {"submit": on_submit}

        The frontend can send a single event payload:

        >>> {"event": "submit", "value": "payload"}

        Or a list of event payloads to be processed in order:

        >>> [{"event": "edit", ...}, {"event": "submit", ...}]
        """
        widget_proto_state = self._new_widget_state.get_serialized(wid)
        if not widget_proto_state:
            return

        # JSON trigger aggregator: value is deserialized by metadata.deserializer
        if widget_proto_state.json_trigger_value:
            try:
                deserialized = self._new_widget_state[wid]
            except KeyError:
                deserialized = None

            payloads: list[object]
            if isinstance(deserialized, list):
                payloads = deserialized
            else:
                payloads = [deserialized]

            for payload in payloads:
                if isinstance(payload, dict):
                    event_name = cast("Mapping[str, object]", payload).get("event")
                    if isinstance(event_name, str) and metadata.callbacks:
                        cb = metadata.callbacks.get(event_name)
                        if cb is not None:
                            self._execute_widget_callback(
                                votes, cb, metadata, args, kwargs
                            )

    def _dispatch_json_change_callbacks(
        self,
        votes: _CallbackRerunVotes,
        wid: str,
        metadata: WidgetMetadata[Any],
        args: WidgetArgs,
        kwargs: dict[str, Any],
    ) -> None:
        """Dispatch change callbacks for JSON-valued widgets.

        Computes a shallow diff between the new and old JSON maps and invokes
        callbacks for keys that changed or were added/removed.

        Parameters
        ----------
        votes : _CallbackRerunVotes
            Accumulator that each dispatched callback records its rerun request on.
        wid : str
            The widget ID.
        metadata : WidgetMetadata[Any]
            Metadata for the widget, including registered callbacks.
        args : WidgetArgs
            Positional arguments forwarded to the callback.
        kwargs : dict[str, Any]
            Keyword arguments forwarded to the callback.
        """
        if not metadata.callbacks:
            return

        try:
            new_val = self._new_widget_state.get(wid)
        except KeyError:
            new_val = None
        old_val = self._old_state.get(wid)

        def unwrap(obj: object) -> dict[str, object]:
            if not isinstance(obj, dict):
                return {}

            obj = cast("dict[str, Any]", obj)
            if set(obj.keys()) == {"value"}:
                value = obj.get("value")
                if isinstance(value, dict):
                    return dict(value)  # shallow copy

            return dict(obj)

        new_map = unwrap(new_val)
        old_map = unwrap(old_val)

        if new_map or old_map:
            all_keys = new_map.keys() | old_map.keys()
            changed_keys = {k for k in all_keys if old_map.get(k) != new_map.get(k)}

            for key in changed_keys:
                cb = metadata.callbacks.get(key)
                if cb is not None:
                    self._execute_widget_callback(votes, cb, metadata, args, kwargs)

    def _widget_changed(self, widget_id: str) -> bool:
        """True if the given widget's value changed between the previous
        script run and the current script run.
        """
        new_value = self._new_widget_state.get(widget_id)
        old_value = self._old_state.get(widget_id)
        changed: bool = new_value != old_value
        return changed

    def on_script_finished(
        self,
        widget_ids_this_run: frozenset[str],
        *,
        remove_stale_widgets: bool = True,
    ) -> None:
        """Called by ScriptRunner when a script run ends, whether or not its body ran.
        Updates widgets to prepare for the next script run.

        Parameters
        ----------
        widget_ids_this_run: frozenset[str]
            The IDs of the widgets that were accessed during the script
            run. Any widget state whose ID does *not* appear in this set
            is considered "stale" and will be removed.
        remove_stale_widgets: bool
            Whether to drop the stale widget state. Pass False when the run
            never executed its body, since no widget re-registered and every
            widget would look stale. The next run that renders cleans up
            instead. Triggers still reset either way, so a fired callback's
            event is never delivered twice.
        """
        self._reset_triggers()
        if remove_stale_widgets:
            self._remove_stale_widgets(widget_ids_this_run)

    def _reset_triggers(self) -> None:
        """Set all trigger values in our state dictionary to False."""
        for state_id in self._new_widget_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id)
            if metadata is not None and metadata.value_type in _TRIGGER_PROTO_FIELDS:
                if metadata.value_type == "trigger_value":
                    self._new_widget_state[state_id] = Value(False)
                else:
                    self._new_widget_state[state_id] = Value(None)

        for state_id in self._old_state:
            metadata = self._new_widget_state.widget_metadata.get(state_id)
            if metadata is not None and metadata.value_type in _TRIGGER_PROTO_FIELDS:
                if metadata.value_type == "trigger_value":
                    self._old_state[state_id] = False
                else:
                    self._old_state[state_id] = None

    def _remove_stale_widgets(self, active_widget_ids: frozenset[str]) -> None:
        """Remove widget state for widgets whose ids aren't in `active_widget_ids`."""
        ctx = get_script_run_ctx()
        if ctx is None:
            return

        # Before any cleanup, capture the current value for bound stale widgets.
        # The most recent value may live in _new_widget_state (e.g. from
        # set_widgets_from_proto after a user interaction) rather than _old_state
        # (which holds the value from the previous compaction).  We must read it
        # through the full lookup chain before _new_widget_state is cleaned.
        wid_key_map = self._key_id_mapper.id_key_mapping

        def _should_preserve(widget_id: str) -> bool:
            """True if a stale keyed widget's value should be carried forward."""
            return (
                widget_id in self._query_param_bound_widget_ids
                or self._persist_tracker.should_preserve(
                    widget_id, ctx.page_script_hash
                )
            )

        preserved_by_key: dict[str, Any] = {}
        for key in self._old_state:
            if (
                is_element_id(key)
                and _should_preserve(key)
                and key in wid_key_map
                and _is_stale_widget(
                    self._new_widget_state.widget_metadata.get(key),
                    active_widget_ids,
                    ctx.fragment_ids_this_run,
                )
            ):
                user_key = wid_key_map[key]
                try:
                    preserved_by_key[user_key] = self._getitem(key, user_key)
                except KeyError:
                    preserved_by_key[user_key] = self._old_state[key]
                self._persist_tracker.note_preserved_value(
                    key, user_key, ctx.page_script_hash
                )

        # A "page"-scoped value must not outlive a page switch. The widget may
        # never re-register on the new page (that page might not render it), so
        # we can't rely on the registration-time reset — drop any value left
        # under its user key now, or it stays readable via st.session_state.
        # (A set made this run lives in _new_session_state and is left untouched.)
        for user_key in self._persist_tracker.mark_page_switch_drops(
            ctx.page_script_hash,
            wid_key_map,
            is_exempt=lambda wid: wid in self._query_param_bound_widget_ids,
            is_stale=lambda wid: _is_stale_widget(
                self._new_widget_state.widget_metadata.get(wid),
                active_widget_ids,
                ctx.fragment_ids_this_run,
            ),
        ):
            self._old_state.pop(user_key, None)

        self._new_widget_state.remove_stale_widgets(
            active_widget_ids,
            ctx.fragment_ids_this_run,
        )

        # Remove entries from _old_state corresponding to stale widgets.
        self._old_state = {
            k: v
            for k, v in self._old_state.items()
            if (
                not is_element_id(k)
                or not _is_stale_widget(
                    self._new_widget_state.widget_metadata.get(k),
                    active_widget_ids,
                    ctx.fragment_ids_this_run,
                )
            )
        }

        # Re-add the preserved values under their user keys.
        self._old_state.update(preserved_by_key)

        # A keyed widget can remount under a new element id this run (e.g. after
        # a page switch) while its user key stays the same. The value was just
        # preserved under the user key, so copy it onto the new element id —
        # otherwise the default written for that id at registration shadows it,
        # since a value stored by element id outranks one stored by user key.
        for user_key, value in preserved_by_key.items():
            active_id = self._key_id_mapper.get_id_from_key(user_key, None)
            if active_id is not None and active_id in active_widget_ids:
                self._new_widget_state.set_from_value(active_id, value)

        # Remove query param bindings and URL params for stale widgets.
        # For fragment runs, preserve widgets outside the running fragment(s).
        # Note: For MPA page transitions, query param filtering is performed
        # via populate_from_query_string() in script_runner.py before this cleanup,
        # so bindings for non-active pages are already filtered by script hash.
        self.query_params.remove_stale_bindings(
            active_widget_ids,
            ctx.fragment_ids_this_run,
            self._new_widget_state.widget_metadata,
        )

        # Keep only bound-intent entries that still have a key mapping.
        # This prevents unbounded growth across long sessions with many stale
        # widget IDs while preserving currently mapped keyed widgets.
        self._query_param_bound_widget_ids.intersection_update(wid_key_map.keys())
        self._persist_tracker.prune(wid_key_map.keys(), self._old_state)

    def _get_widget_metadata(self, widget_id: str) -> WidgetMetadata[Any] | None:
        """Return the metadata for a widget id from the current widget state."""
        return self._new_widget_state.widget_metadata.get(widget_id)

    def _set_widget_metadata(self, widget_metadata: WidgetMetadata[Any]) -> None:
        """Set a widget's metadata."""
        widget_id = widget_metadata.id
        self._new_widget_state.widget_metadata[widget_id] = widget_metadata

    def get_widget_states(self) -> list[WidgetStateProto]:
        """Return a list of serialized widget values for each widget with a value."""
        return self._new_widget_state.as_widget_states()

    def _get_widget_id(self, k: str) -> str:
        """Turns a value that might be a widget id or a user provided key into
        an appropriate widget id.
        """
        # It's guaranteed that the key is a string since the default is string,
        # so we can cast it to str here:
        return cast("str", self._key_id_mapper.get_id_from_key(k, k))

    def _set_key_widget_mapping(self, widget_id: str, user_key: str) -> None:
        self._key_id_mapper[user_key] = widget_id

    def _drop_widget_value(self, widget_id: str, user_key: str) -> bool:
        """Forget any stored value for a widget, both by id and by user key.

        Returns True if a value was removed. Values set during the current run
        via ``_new_session_state`` represent the current run's intent and are
        left untouched.
        """
        removed = self._new_widget_state.states.pop(widget_id, None) is not None
        removed = self._old_state.pop(widget_id, None) is not None or removed
        removed = self._old_state.pop(user_key, None) is not None or removed
        return removed

    def register_widget(
        self, metadata: WidgetMetadata[T], user_key: str | None
    ) -> RegisterWidgetResult[T]:
        """Register a widget with the SessionState.

        Returns
        -------
        RegisterWidgetResult[T]
            Contains the widget's current value, and a bool that will be True
            if the frontend needs to be updated with the current value.
        """
        widget_id = metadata.id
        ctx = get_script_run_ctx()

        # Capture the stored wire value *before* swapping in this run's
        # serializer, so it reflects the value as it was actually stored (using
        # the serializer it was stored with). For string and string-array widgets
        # we expose this so callers can reconcile a stored value against freshly
        # computed state without re-deriving it from the deserialized value.
        incoming_serialized_value: str | None = None
        incoming_serialized_values: list[str] | None = None
        if metadata.value_type == "string_value":
            stored_proto = self._new_widget_state.get_serialized(widget_id)
            if (
                stored_proto is not None
                and stored_proto.WhichOneof("value") == "string_value"
            ):
                incoming_serialized_value = stored_proto.string_value
        elif metadata.value_type == "string_array_value":
            stored_proto = self._new_widget_state.get_serialized(widget_id)
            if (
                stored_proto is not None
                and stored_proto.WhichOneof("value") == "string_array_value"
            ):
                incoming_serialized_values = list(stored_proto.string_array_value.data)

        self._set_widget_metadata(metadata)
        if user_key is not None:
            # If the widget has a user_key, update its user_key:widget_id mapping
            self._set_key_widget_mapping(widget_id, user_key)

        # Handle query param binding
        url_value_seeded = False
        if metadata.bind == "query-params" and user_key is not None:
            self._query_param_bound_widget_ids.add(widget_id)
            url_value_seeded = self._handle_query_param_binding(
                metadata, user_key, widget_id
            )
        elif metadata.bind is None and user_key is not None:
            # Widget stopped using bind — clean up any stale binding
            self._query_param_bound_widget_ids.discard(widget_id)
            self.query_params.unbind_and_clear_param(widget_id)

        # Keep persist_state tracking in sync (server-side only, no URL) and drop
        # the stored value if the tracker says it's no longer valid for this page.
        dropped_page_scoped_value = False
        if metadata.persist_state is not None and user_key is not None:
            current_page_hash = ctx.page_script_hash if ctx is not None else ""
            self._persist_tracker.register(
                widget_id, user_key, metadata.persist_state, current_page_hash
            )
            should_drop = self._persist_tracker.take_pending_drop(
                widget_id,
                user_key,
                current_page_hash,
                is_bound=metadata.bind == "query-params",
            )
            if should_drop:
                dropped_page_scoped_value = self._drop_widget_value(widget_id, user_key)
        elif metadata.persist_state is None and user_key is not None:
            # Widget stopped persisting — drop any stale tracking.
            self._persist_tracker.untrack(widget_id, user_key)

        # Enforce `disabled` server-side. A disabled widget cannot be interacted
        # with in the browser, so any value in widget state is a stale/forged
        # frontend value and must be dropped, so resolution falls back to the
        # widget's previous value (or its default on first registration).
        # URL-seeded values are exempt: they populate widget state legitimately
        # for bound widgets (url_value_seeded). A programmatic st.session_state
        # assignment lives in _new_session_state and still wins during
        # resolution, so dropping the forged widget-state entry never affects it
        # while preventing the forged value from lingering there until compaction.
        disabled_value_discarded = False
        if (
            metadata.disabled
            and widget_id in self._new_widget_state
            and not url_value_seeded
        ):
            del self._new_widget_state[widget_id]
            # The captured wire label belongs to the dropped frontend value, so
            # it must not leak to callers. Otherwise a caller like st.selectbox
            # could reconcile options against this attacker-controlled label (see
            # resolve_value_against_options) and hand back an option that differs
            # from the value we resolve below.
            incoming_serialized_value = None
            if user_key is None or user_key not in self._new_session_state:
                # No programmatic value is taking over resolution, so the discard
                # itself changes the resolved value; flag the frontend to re-sync.
                disabled_value_discarded = True

        if (
            widget_id not in self
            and (user_key is None or user_key not in self)
            and not url_value_seeded
        ):
            # This is the first time the widget is registered, so we save its
            # value in widget state (unless we already seeded from URL).
            deserializer = metadata.deserializer
            initial_widget_value = deepcopy(deserializer(None))
            self._new_widget_state.set_from_value(widget_id, initial_widget_value)

        # Get the current value of the widget for use as its return value.
        # We return a copy, so that reference types can't be accidentally
        # mutated by user code.
        widget_value = cast("T", self[widget_id])
        widget_value = deepcopy(widget_value)

        # Sync bound widget value ↔ URL after value resolution.
        #
        # Non-default restore: write param when it was lost (page nav / remount).
        # The user_key-in-_old_state guard ensures this only fires for values
        # that were explicitly preserved under a user key by _remove_stale_widgets.
        # Compacted programmatic sets (st.session_state["k"] = v) are stored
        # under widget IDs only, so the guard correctly excludes them.
        #
        # Programmatic set (user_key in _new_session_state): sync URL when the
        # resolved value differs from the backend query snapshot, so reloads
        # stay consistent (see issue #14670).
        #
        # Default collapsing: remove stale params the frontend already cleared.
        # The backend's _query_params is not refreshed on same-page reruns, so
        # it can hold entries the frontend already deleted.  Cleaning them here
        # prevents _send_query_param_msg from re-broadcasting stale params.
        # Programmatic reset to default uses remove_param so the browser URL
        # is updated when the frontend still shows the old query string.
        restored_bound_value = False
        if metadata.bind == "query-params" and user_key is not None:
            default_value = metadata.deserializer(None)
            if widget_value != default_value:
                if (
                    user_key in self._old_state
                    and not self.query_params.has_param(user_key)
                    and user_key not in self._new_session_state
                ):
                    serialized = metadata.serializer(widget_value)
                    self.query_params.set_corrected_value(
                        user_key, serialized, metadata.value_type
                    )
                    restored_bound_value = True
                elif (
                    user_key in self._new_session_state
                    and not url_value_seeded
                    and (widget_id in self._old_state or user_key in self._old_state)
                ):
                    serialized = metadata.serializer(widget_value)
                    if not self.query_params.stored_param_matches_corrected_value(
                        user_key, serialized, metadata.value_type
                    ):
                        self.query_params.set_corrected_value(
                            user_key, serialized, metadata.value_type
                        )
            elif (
                user_key in self._new_session_state
                and not url_value_seeded
                and self.query_params.has_param(user_key)
                and (widget_id in self._old_state or user_key in self._old_state)
            ):
                self.query_params.remove_param(user_key)
            else:
                self.query_params.discard_param_no_forward_msg(user_key)

        # A persist_state widget resolving to a non-default value from a previous
        # run (preserved while unmounted, or a compacted programmatic set) must
        # tell the frontend to adopt the backend value on (re)mount. Otherwise it
        # renders at its default and the next rerun overwrites the preserved value.
        # For a bind + persist_state widget this can overlap with
        # restored_bound_value; that is harmless since both only feed the OR below.
        restored_persisted_value = False
        if (
            metadata.persist_state is not None
            and user_key is not None
            and not self.is_new_state_value(user_key)
            and widget_id not in self._new_widget_state
            and (widget_id in self._old_state or user_key in self._old_state)
        ):
            default_value = metadata.deserializer(None)
            if widget_value != default_value:
                restored_persisted_value = True

        # widget_value_changed indicates to the caller that the widget's current
        # value is different from what is in the frontend. True when:
        # - the value changed this run;
        # - a bound value was restored to the URL — the frontend renders the
        #   widget for the first time on this page and must use the backend's
        #   resolved value instead of the widget's default;
        # - a persisted value was restored from session state on (re)mount, for
        #   the same reason;
        # - a "page"-scoped value was dropped on a page switch, so the frontend
        #   must fall back to the default for the reused widget id.
        widget_value_changed = (
            (user_key is not None and self.is_new_state_value(user_key))
            or restored_bound_value
            or restored_persisted_value
            or dropped_page_scoped_value
            or disabled_value_discarded
        )

        return RegisterWidgetResult(
            widget_value,
            widget_value_changed,
            incoming_serialized_value=incoming_serialized_value,
            incoming_serialized_values=incoming_serialized_values,
        )

    def _handle_query_param_binding(
        self, metadata: WidgetMetadata[T], user_key: str, widget_id: str
    ) -> bool:
        """Handle query param binding for a widget.

        Registers the binding, then attempts to seed the widget's value from URL
        based on priority rules:

        - On initial load, URL wins (enables shareable URLs)
        - On subsequent reruns, session_state values win
        - User interaction (frontend value) always wins

        Returns True if the widget's value was seeded from URL, False otherwise.
        """
        # Register the widget binding
        ctx = get_script_run_ctx()
        script_hash = ThreadState.get().active_script_hash if ctx is not None else ""
        self.query_params.bind_widget(
            param_key=user_key,
            widget_id=widget_id,
            value_type=metadata.value_type,
            script_hash=script_hash,
        )

        # Check priority rules - skip seeding if user/code has already set a value.
        # A disabled widget is exempt: it cannot be interacted with, so any value in
        # _new_widget_state is a stale/forged frontend value. Let URL seeding proceed;
        # disabled enforcement in register_widget then discards the forged value.
        if widget_id in self._new_widget_state and not metadata.disabled:
            return False
        is_initial_load = widget_id not in self._old_state
        if not is_initial_load and user_key in self._new_session_state:
            return False  # Code set value after first run

        url_value = self.query_params.get_initial_value(user_key)
        if url_value is None:
            return False

        return self._seed_widget_from_url(metadata, user_key, widget_id, url_value)

    def _seed_widget_from_url(
        self,
        metadata: WidgetMetadata[T],
        user_key: str,
        widget_id: str,
        url_value: str | list[str],
    ) -> bool:
        """Parse URL value, seed widget state, and auto-correct URL if needed.

        This method:
        1. Checks if the URL value is empty and handles based on clearable
        2. Parses the raw URL string using the widget's value_type
        3. Deserializes to the widget's native value format
        4. Handles invalid values (clears URL param, returns False)
        5. Stores valid values in both widget state and session state
        6. Auto-corrects the URL if the value was clamped/filtered

        Returns True if seeding succeeded, False if the URL value was invalid.
        """
        # Check if URL value is empty (e.g., ?foo= with no value)
        if is_empty_url_value(url_value) and not metadata.clearable:
            # Widget doesn't allow empty state - clear the invalid param
            self._clear_url_param(user_key)
            return False

        try:
            parsed_value = parse_url_param(url_value, metadata.value_type)
            deserialized_value = metadata.deserializer(parsed_value)
            default_value = metadata.deserializer(None)

            # If the deserialized value equals the default, clear the param.
            # Default values should not be kept in the URL — this matches the
            # frontend's shouldClearUrlParam behavior. This handles:
            # 1. Valid input that equals the default (e.g., ?dark_mode=FALSE)
            # 2. Invalid input that the deserializer rejected and fell back to default
            # 3. Valid input that normalized to match the default (e.g., "000000" -> "#000000")
            if deserialized_value == default_value:
                self._clear_url_param(user_key)
                return False

            # Handle case where all URL values were invalid (filtered to empty list).
            # For array types, parsed_value is always a list. If it had values that
            # were all filtered by the deserializer (e.g., invalid options), clear URL.
            if (
                isinstance(deserialized_value, list)
                and len(deserialized_value) == 0
                and parsed_value  # Non-empty list means URL had values
            ):
                self._clear_url_param(user_key)
                return False

            # For string_value selection widgets (radio, selectbox), validate
            # that the parsed URL value is a known option. The deserializer
            # passes unknown options through as-is (needed for dynamic option
            # changes and accept_new_options), so we check here instead.
            # Widgets opt in by passing formatted_options to register_widget.
            if (
                metadata.formatted_options is not None
                and metadata.value_type == "string_value"
                and isinstance(parsed_value, str)
                and parsed_value not in metadata.formatted_options
            ):
                self._clear_url_param(user_key)
                return False

            # For string_array_value widgets (e.g. multiselect, select_slider),
            # sanitize the parsed URL values: filter invalid options, optionally
            # deduplicate, and enforce max length.
            if metadata.value_type == "string_array_value" and isinstance(
                parsed_value, list
            ):
                sanitized = _sanitize_url_array(
                    parsed_value,
                    valid_options=metadata.formatted_options,
                    max_length=metadata.max_array_length,
                    allow_duplicates=metadata.allow_url_duplicates,
                )
                if sanitized is not None:
                    if not sanitized:
                        self._clear_url_param(user_key)
                        return False
                    deserialized_value = metadata.deserializer(sanitized)
                    if deserialized_value == default_value:
                        self._clear_url_param(user_key)
                        return False

            # Store the value in widget and session state
            self._new_widget_state.set_from_value(widget_id, deserialized_value)
            self._new_session_state[user_key] = deserialized_value

            # Auto-correct URL if value was clamped/filtered
            self._auto_correct_url_if_needed(
                metadata, user_key, parsed_value, deserialized_value
            )
            return True

        except (ValueError, TypeError, IndexError) as e:
            _LOGGER.debug(
                "Invalid URL value for bound widget '%s', clearing param: %s",
                user_key,
                e,
            )
            self._clear_url_param(user_key)
            return False

    def _clear_url_param(self, user_key: str) -> None:
        """Clear an invalid URL parameter and notify frontend."""
        self.query_params.remove_param(user_key)

    def _auto_correct_url_if_needed(
        self,
        metadata: WidgetMetadata[T],
        user_key: str,
        parsed_value: Any,
        deserialized_value: Any,
    ) -> None:
        """Auto-correct URL if the value was clamped or filtered."""
        serialized_value = metadata.serializer(deserialized_value)
        if serialized_value == parsed_value:
            return  # No correction needed

        self.query_params.set_corrected_value(
            user_key, serialized_value, metadata.value_type
        )

    def __contains__(self, key: str) -> bool:
        try:
            self[key]
        except KeyError:
            return False
        else:
            return True

    def get_stats(
        self,
        family_names: Sequence[str] | None = None,  # noqa: ARG002
    ) -> dict[str, list[CacheStat]]:
        if config.get_option("server.enableExpensiveMemoryStats"):
            from streamlit.runtime.stats import safe_sizeof

            byte_length = safe_sizeof(self)
        else:
            # Use a cheap item-count proxy instead of traversing the session
            # state values, which can be very expensive.
            byte_length = len(self)

        stat = CacheStat("st_session_state", "", byte_length)
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: [stat]}

    def _check_serializable(self) -> None:
        """Verify that everything added to session state can be serialized.
        We use pickleability as the metric for serializability, and test for
        pickleability by just trying it.
        """
        for k in self:
            try:
                pickle.dumps(self[k])
            except Exception as e:  # noqa: PERF203
                err_msg = (
                    f"Cannot serialize the value (of type `{type(self[k])}`) of '{k}' in "
                    "st.session_state. Streamlit has been configured to use "
                    "[pickle](https://docs.python.org/3/library/pickle.html) to "
                    "serialize session_state values. Please convert the value to a "
                    "pickle-serializable type. To learn more about this behavior, "
                    "see [our docs](https://docs.streamlit.io/knowledge-base/using-streamlit/serializable-session-state)."
                )
                raise UnserializableSessionStateError(err_msg) from e

    def maybe_check_serializable(self) -> None:
        """Verify that session state can be serialized, if the relevant config
        option is set.

        See `_check_serializable` for details.
        """
        if config.get_option("runner.enforceSerializableSessionState"):
            self._check_serializable()


def _is_internal_key(key: str) -> bool:
    return key.startswith(STREAMLIT_INTERNAL_KEY_PREFIX)


def _is_stale_widget(
    metadata: WidgetMetadata[Any] | None,
    active_widget_ids: frozenset[str],
    fragment_ids_this_run: list[str] | None,
) -> bool:
    if not metadata:
        return True

    # If we're running 1 or more fragments, but this widget is unrelated to any of the
    # fragments that we're running, then it should not be marked as stale as its value
    # may still be needed for a future fragment run or full script run.
    return not (
        metadata.id in active_widget_ids
        or (fragment_ids_this_run and metadata.fragment_id not in fragment_ids_this_run)
    )


@dataclass
class SessionStateStatProvider(StatsProvider):
    _session_mgr: SessionManager

    @property
    def stats_families(self) -> Sequence[str]:
        return (CACHE_MEMORY_FAMILY,)

    def get_stats(
        self,
        family_names: Sequence[str] | None = None,  # noqa: ARG002
    ) -> dict[str, list[CacheStat]]:
        stats: list[CacheStat] = []
        for session_info in self._session_mgr.list_active_sessions():
            session_state = session_info.session.session_state
            session_stats = session_state.get_stats()
            for family_stats in session_stats.values():
                stats.extend(family_stats)
        if not stats:
            return {}
        # In general, get_stats methods need to be able to return only requested stat
        # families, but this method only returns a single family, and we're guaranteed
        # that it was one of those requested if we make it here.
        return {CACHE_MEMORY_FAMILY: group_cache_stats(stats)}
