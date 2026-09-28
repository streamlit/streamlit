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

"""Drive Runtime sessions for POST /_stcore/agent/v1/interact."""

from __future__ import annotations

import asyncio
import json
import threading
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import TYPE_CHECKING, Any, Final, cast
from urllib.parse import parse_qs, urlencode

from streamlit import config
from streamlit.proto.BackMsg_pb2 import BackMsg
from streamlit.proto.ClientState_pb2 import ClientState
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.WidgetStates_pb2 import WidgetState, WidgetStates
from streamlit.runtime.app_session import AppSession, AppSessionState
from streamlit.runtime.session_manager import (
    ClientContext,
    SessionClientDisconnectedError,
)
from streamlit.testing.v1.element_tree import (
    ElementTree,
    Widget,
    parse_tree_from_messages,
)
from streamlit.testing.v1.errors import AppTestError
from streamlit.web.server.agent.agent_tree_json import (
    element_tree_to_agent_json,
    run_reported_ok,
)

if TYPE_CHECKING:
    from collections.abc import Mapping

_AGENT_USER_INFO: Final[dict[str, None]] = {"email": None}

_TERMINAL_FINISHED: Final[frozenset[int]] = frozenset(
    {
        ForwardMsg.FINISHED_SUCCESSFULLY,
        ForwardMsg.FINISHED_WITH_COMPILE_ERROR,
        ForwardMsg.FINISHED_FRAGMENT_RUN_SUCCESSFULLY,
    }
)


class AgentInteractError(Exception):
    """A request that must fail before or instead of a script run."""

    def __init__(self, code: str, message: str, *, http_status: int = 400) -> None:
        super().__init__(message)
        self.code = code
        self.message = message
        self.http_status = http_status


class _AgentClientContext:
    def __init__(self, remote_ip: str | None) -> None:
        self._remote_ip = remote_ip

    @property
    def headers(self) -> list[tuple[str, str]]:
        return []

    @property
    def cookies(self) -> dict[str, str]:
        return {}

    @property
    def remote_ip(self) -> str | None:
        return self._remote_ip


class AgentSessionClient:
    """SessionClient that captures ForwardMsgs for the agent HTTP path."""

    def __init__(self, remote_ip: str | None) -> None:
        self._context = _AgentClientContext(remote_ip)
        self._lock = threading.Lock()
        self._closed = False
        self._current_run: list[ForwardMsg] = []

    def write_forward_msg(self, msg: ForwardMsg) -> None:
        if self._closed:
            raise SessionClientDisconnectedError()
        with self._lock:
            if msg.WhichOneof("type") == "new_session":
                self._current_run = [msg]
            else:
                self._current_run.append(msg)

    @property
    def client_context(self) -> ClientContext:
        return self._context

    def current_run_messages(self) -> list[ForwardMsg]:
        with self._lock:
            return list(self._current_run)

    def reset_run_buffer(self) -> None:
        """Drop captured messages so the next wait is for a new run."""
        with self._lock:
            self._current_run = []

    def close(self) -> None:
        self._closed = True


@dataclass
class _AgentSession:
    client: AgentSessionClient
    lock: asyncio.Lock
    last_tree: ElementTree | None = None


_SESSIONS: dict[str, _AgentSession] = {}
_SESSIONS_GUARD: Final = threading.Lock()


def reset_agent_sessions() -> None:
    """Drop in-memory agent session handles. Used by unit tests."""
    with _SESSIONS_GUARD:
        _SESSIONS.clear()


@dataclass
class AgentInteractRequest:
    session_id: str | None = None
    widget_state: dict[str, Any] = field(default_factory=dict)
    trigger: dict[str, Any] | None = None
    page: str | None = None
    query_params: dict[str, list[str]] | None = None


def parse_interact_request(body: Any) -> AgentInteractRequest:
    """Parse and type-check the JSON body of an interact call."""
    if body is None:
        body = {}
    if not isinstance(body, dict):
        raise AgentInteractError(
            "invalid_request",
            "Request body must be a JSON object.",
        )

    session_id = body.get("session_id")
    if session_id is not None and not isinstance(session_id, str):
        raise AgentInteractError("invalid_request", "session_id must be a string.")

    widget_state = body.get("widget_state") or {}
    if not isinstance(widget_state, dict):
        raise AgentInteractError(
            "invalid_request",
            "widget_state must be an object mapping keys to JSON values.",
        )

    trigger = body.get("trigger")
    if trigger is not None:
        if not isinstance(trigger, dict) or "key" not in trigger:
            raise AgentInteractError(
                "invalid_request",
                'trigger must be an object with a "key" field.',
            )
        if not isinstance(trigger["key"], str):
            raise AgentInteractError("invalid_request", "trigger.key must be a string.")

    page = body.get("page")
    if page is not None and not isinstance(page, str):
        raise AgentInteractError("invalid_request", "page must be a string url_path.")

    query_params = body.get("query_params")
    parsed_query: dict[str, list[str]] | None = None
    if query_params is not None:
        if not isinstance(query_params, dict):
            raise AgentInteractError(
                "invalid_request",
                "query_params must be an object of name → list of strings.",
            )
        parsed_query = {}
        for name, values in query_params.items():
            if not isinstance(name, str):
                raise AgentInteractError(
                    "invalid_request", "query_params keys must be strings."
                )
            if isinstance(values, str):
                parsed_query[name] = [values]
            elif isinstance(values, list) and all(isinstance(v, str) for v in values):
                parsed_query[name] = list(values)
            else:
                raise AgentInteractError(
                    "invalid_request",
                    "query_params values must be strings or lists of strings.",
                )

    creating = session_id is None
    has_widget_changes = bool(widget_state) or trigger is not None
    has_navigation = page is not None or query_params is not None
    if creating and has_widget_changes:
        raise AgentInteractError(
            "widget_state_on_create",
            "widget_state and trigger are not accepted when creating a session.",
        )
    if has_navigation and has_widget_changes:
        raise AgentInteractError(
            "navigation_with_widget_changes",
            "page and query_params cannot be combined with widget_state or trigger.",
        )

    return AgentInteractRequest(
        session_id=session_id,
        widget_state=widget_state,
        trigger=trigger,
        page=page,
        query_params=parsed_query,
    )


async def interact(
    runtime: Any,
    request: AgentInteractRequest,
    *,
    remote_ip: str | None,
) -> dict[str, Any]:
    """Create or continue a session, run the script, and return a snapshot."""
    agent_session, session_id, created = _resolve_session(
        runtime, request.session_id, remote_ip
    )
    async with agent_session.lock:
        app_session = _require_app_session(runtime, session_id)
        _attach_tree_runner(agent_session.last_tree, app_session)
        client_state = _build_client_state(
            request,
            created=created,
            last_tree=agent_session.last_tree,
            app_session=app_session,
        )
        backmsg = BackMsg()
        backmsg.rerun_script.CopyFrom(client_state)
        agent_session.client.reset_run_buffer()
        runtime.handle_backmsg(session_id, backmsg, client=agent_session.client)
        timeout = float(config.get_option("server.agentRunTimeout"))
        await wait_for_script_run_chain(app_session, agent_session.client, timeout)
        tree = parse_tree_from_messages(agent_session.client.current_run_messages())
        _attach_tree_runner(tree, app_session)
        agent_session.last_tree = tree
        run_ok = run_reported_ok(app_session.session_state, tree)
        pages, page = _pages_payload(app_session)
        query_params = parse_qs(
            app_session._client_state.query_string, keep_blank_values=True
        )
        return element_tree_to_agent_json(
            tree,
            session_id=session_id,
            pages=pages,
            page=page,
            query_params=query_params,
            run_ok=run_ok,
            observed_at=datetime.now(timezone.utc)
            .replace(microsecond=0)
            .isoformat()
            .replace("+00:00", "Z"),
            session_state=app_session.session_state,
        )


async def wait_for_script_run_chain(
    session: AppSession,
    client: AgentSessionClient,
    timeout: float,
) -> None:
    """Block until the session is idle after a terminal script_finished event."""
    deadline = asyncio.get_running_loop().time() + timeout
    saw_start = False
    while asyncio.get_running_loop().time() < deadline:
        messages = client.current_run_messages()
        finished: int | None = None
        for msg in messages:
            which = msg.WhichOneof("type")
            if which == "new_session":
                saw_start = True
            elif which == "script_finished":
                finished = msg.script_finished
        if (
            saw_start
            and session._state == AppSessionState.APP_NOT_RUNNING
            and finished in _TERMINAL_FINISHED
        ):
            return
        await asyncio.sleep(0.02)
    raise AgentInteractError(
        "run_timed_out",
        "The script run exceeded server.agentRunTimeout.",
        http_status=504,
    )


def _resolve_session(
    runtime: Any, session_id: str | None, remote_ip: str | None
) -> tuple[_AgentSession, str, bool]:
    if session_id is None:
        client = AgentSessionClient(remote_ip)
        new_id = runtime.connect_session(
            client=client, user_info=dict(_AGENT_USER_INFO)
        )
        agent_session = _AgentSession(client=client, lock=asyncio.Lock())
        with _SESSIONS_GUARD:
            _SESSIONS[new_id] = agent_session
        return agent_session, new_id, True

    with _SESSIONS_GUARD:
        existing = _SESSIONS.get(session_id)
    if existing is None and not runtime.is_active_session(session_id):
        raise AgentInteractError(
            "unknown_session",
            "Unknown or expired session_id.",
            http_status=404,
        )
    if existing is None:
        client = AgentSessionClient(remote_ip)
        connected_id = runtime.connect_session(
            client=client,
            user_info=dict(_AGENT_USER_INFO),
            existing_session_id=session_id,
        )
        agent_session = _AgentSession(client=client, lock=asyncio.Lock())
        with _SESSIONS_GUARD:
            _SESSIONS[connected_id] = agent_session
        return agent_session, connected_id, False

    if not runtime.is_active_session(session_id):
        connected_id = runtime.connect_session(
            client=existing.client,
            user_info=dict(_AGENT_USER_INFO),
            existing_session_id=session_id,
        )
        if connected_id != session_id:
            raise AgentInteractError(
                "unknown_session",
                "Unknown or expired session_id.",
                http_status=404,
            )
    return existing, session_id, False


def _require_app_session(runtime: Any, session_id: str) -> AppSession:
    session_info = runtime._session_mgr.get_active_session_info(session_id)
    if session_info is None:
        raise AgentInteractError(
            "unknown_session",
            "Unknown or expired session_id.",
            http_status=404,
        )
    return cast("AppSession", session_info.session)


def _attach_tree_runner(tree: ElementTree | None, app_session: AppSession) -> None:
    if tree is None:
        return
    tree._runner = type(
        "_AgentTreeRunner",
        (),
        {
            "_session_state": app_session.session_state,
            "_cleared_form_ids": set(),
        },
    )()


def _build_client_state(
    request: AgentInteractRequest,
    *,
    created: bool,
    last_tree: ElementTree | None,
    app_session: AppSession,
) -> ClientState:
    client_state = ClientState()
    previous = app_session._client_state
    if request.query_params is None:
        client_state.query_string = previous.query_string
    else:
        client_state.query_string = urlencode(
            [
                (name, value)
                for name, values in request.query_params.items()
                for value in values
            ]
        )
    if request.page is not None:
        client_state.page_name = request.page
    else:
        client_state.page_script_hash = previous.page_script_hash
        client_state.page_name = previous.page_name

    if created:
        return client_state

    if last_tree is None:
        client_state.widget_states.CopyFrom(previous.widget_states)
        return client_state

    patched = _apply_widget_patch(last_tree, request.widget_state, request.trigger)
    client_state.widget_states.CopyFrom(
        _merge_widget_states(previous.widget_states, patched)
    )
    return client_state


def _merge_widget_states(previous: WidgetStates, patched: list[Widget]) -> WidgetStates:
    by_id = {widget.id: widget for widget in previous.widgets}
    for node in patched:
        by_id[node.id] = _encode_widget_state(node)
    merged = WidgetStates()
    merged.widgets.extend(by_id.values())
    return merged


def _encode_widget_state(node: Widget) -> WidgetState:
    """Serialize a patched widget into the wire format a browser would send.

    Each arm mirrors the widget's own serializer, because the ScriptRunner
    deserializes strictly by ``WidgetState`` value arm: putting a slider on
    ``double_value`` instead of ``double_array_value`` is silently read as an
    unset widget rather than rejected.
    """
    ws = WidgetState()
    ws.id = node.id
    value = getattr(node, "_value", None)
    widget_type = node.type

    if widget_type in {"button", "download_button"}:
        ws.trigger_value = bool(value)
    elif widget_type == "chat_input":
        if value is not None:
            ws.chat_input_value.data = str(value)
    elif widget_type == "menu_button":
        if value is not None:
            ws.string_trigger_value.data = _option_label(node, value)
    elif widget_type in {"checkbox", "toggle"}:
        ws.bool_value = bool(value)
    elif widget_type in {"text_input", "text_area", "color_picker"}:
        if value is not None:
            ws.string_value = str(value)
    elif widget_type in {"selectbox", "radio"}:
        if value is not None:
            ws.string_value = _option_label(node, value)
    elif widget_type in {"multiselect", "button_group", "select_slider"}:
        ws.string_array_value.data[:] = [
            _option_label(node, item) for item in _as_sequence(value)
        ]
    elif widget_type == "feedback":
        # An empty string means "cleared"; an unset field means "never touched".
        ws.string_value = "" if value is None else str(_as_number(node, value, int))
    elif widget_type == "number_input":
        if value is not None:
            ws.double_value = _as_number(node, value, float)
    elif widget_type == "slider":
        ws.double_array_value.data[:] = _serialize_slider(node, value)
    elif widget_type == "date_input":
        ws.string_array_value.data[:] = _serialize_date_input(node, value)
    elif widget_type == "time_input":
        serialized = _serialize_time_input(node, value)
        if serialized is not None:
            ws.string_value = serialized
    elif widget_type == "date_time_input":
        ws.string_array_value.data[:] = _serialize_date_time_input(node, value)
    elif value is not None:
        ws.json_value = json.dumps(value)
    return ws


def _as_sequence(value: Any) -> list[Any]:
    """Normalize a scalar or list into a list, treating None as empty."""
    if value is None:
        return []
    if isinstance(value, (list, tuple)):
        return list(value)
    return [value]


def _option_labels(node: Widget) -> list[str]:
    """Return the widget's options as the labels shown to the user."""
    raw = getattr(node.proto, "options", None) or []
    # st.pills / st.segmented_control wrap each option in a message.
    return [str(getattr(option, "content", option)) for option in raw]


def _option_label(node: Widget, value: Any) -> str:
    """Validate a requested selection against the widget's options.

    Option widgets travel over the wire as the option's label, which is exactly
    what the snapshot advertises in ``props.options``.
    """
    labels = _option_labels(node)
    text = value if isinstance(value, str) else str(value)
    if labels and text not in labels:
        raise AgentInteractError(
            "invalid_widget_value",
            f"{text!r} is not an option of the {node.type} "
            f"{_widget_label(node)}. Valid options: {labels}.",
        )
    return text


def _widget_label(node: Widget) -> str:
    key = getattr(node, "key", None) or getattr(node, "id", "")
    return f"'{key}'"


def _as_number(node: Widget, value: Any, kind: type) -> Any:
    if isinstance(value, bool) or not isinstance(value, (int, float, str)):
        raise AgentInteractError(
            "invalid_widget_value",
            f"The {node.type} {_widget_label(node)} expects a number, "
            f"got {type(value).__name__}.",
        )
    try:
        return kind(value)
    except (TypeError, ValueError) as exc:
        raise AgentInteractError(
            "invalid_widget_value",
            f"The {node.type} {_widget_label(node)} could not read {value!r} "
            "as a number.",
        ) from exc


def _parse_temporal(node: Widget, value: Any, kind: str) -> Any:
    """Parse an ISO-8601 string (or passthrough value) into a date/time object."""
    from datetime import date as date_cls
    from datetime import datetime as datetime_cls
    from datetime import time as time_cls

    expected = {"date": date_cls, "time": time_cls, "datetime": datetime_cls}[kind]
    if isinstance(value, expected):
        return value
    if isinstance(value, str):
        try:
            if kind == "date":
                return date_cls.fromisoformat(value)
            if kind == "time":
                return time_cls.fromisoformat(value)
            return datetime_cls.fromisoformat(value)
        except ValueError as exc:
            raise AgentInteractError(
                "invalid_widget_value",
                f"The {node.type} {_widget_label(node)} expects an ISO-8601 "
                f"{kind}, got {value!r}.",
            ) from exc
    raise AgentInteractError(
        "invalid_widget_value",
        f"The {node.type} {_widget_label(node)} expects an ISO-8601 {kind} "
        f"string, got {type(value).__name__}.",
    )


def _serialize_slider(node: Widget, value: Any) -> list[float]:
    from streamlit.elements.widgets.slider import SliderSerde
    from streamlit.proto.Slider_pb2 import Slider as SliderProto

    proto = node.proto
    data_type = proto.data_type
    kind = {
        SliderProto.DATE: "date",
        SliderProto.TIME: "time",
        SliderProto.DATETIME: "datetime",
    }.get(data_type)

    points = _as_sequence(value)
    if not points:
        return []
    if kind is not None:
        points = [_parse_temporal(node, point, kind) for point in points]
    else:
        points = [_as_number(node, point, float) for point in points]

    serde = SliderSerde([], data_type, True, None, proto.min, proto.max)
    # A range slider serializes both thumbs; a single slider serializes a scalar.
    return serde.serialize(points if len(points) > 1 else points[0])


def _serialize_date_input(node: Widget, value: Any) -> list[str]:
    from streamlit.elements.widgets.time_widgets import DateInputSerde

    dates = [_parse_temporal(node, item, "date") for item in _as_sequence(value)]
    return DateInputSerde(None).serialize(dates)  # type: ignore[arg-type]


def _serialize_time_input(node: Widget, value: Any) -> str | None:
    from streamlit.elements.widgets.time_widgets import TimeInputSerde

    if value is None:
        return None
    parsed = _parse_temporal(node, value, "time")
    return TimeInputSerde(None, step=getattr(node, "step", 900)).serialize(parsed)


def _serialize_date_time_input(node: Widget, value: Any) -> list[str]:
    from streamlit.elements.widgets.time_widgets import DateTimeInputSerde

    if value is None:
        return []
    parsed = _parse_temporal(node, value, "datetime")
    bounds = [_parse_bound(node.proto, name) for name in ("min", "max")]
    serialized = DateTimeInputSerde(None, min=bounds[0], max=bounds[1]).serialize(
        parsed
    )
    return list(serialized) if serialized is not None else []


def _parse_bound(proto: Any, name: str) -> datetime:
    """Read a ``date_time_input`` bound, which the proto carries as a string."""
    raw = getattr(proto, name, "")
    try:
        return datetime.strptime(raw, "%Y-%m-%dT%H:%M")
    except ValueError:
        pass
    try:
        return datetime.strptime(raw, "%Y/%m/%d, %H:%M")
    except ValueError:
        return datetime.fromisoformat(raw)


def _apply_widget_patch(
    tree: ElementTree,
    widget_state: dict[str, Any],
    trigger: dict[str, Any] | None,
) -> list[Widget]:
    form_ids: set[str] = set()
    patched: list[Widget] = []
    for key, value in widget_state.items():
        node = _find_widget(tree, key)
        _assert_can_set(node)
        form_id = str(getattr(node, "form_id", "") or "")
        if form_id:
            form_ids.add(form_id)
        try:
            node.set_value(value)
        except AppTestError as exc:
            raise AgentInteractError("invalid_widget_value", str(exc)) from exc
        patched.append(node)

    trigger_node: Widget | None = None
    if trigger is not None:
        trigger_node = _find_widget(tree, trigger["key"])
        _assert_can_set(trigger_node)
        trigger_form = str(getattr(trigger_node, "form_id", "") or "")
        if trigger_form:
            form_ids.add(trigger_form)
        try:
            if trigger_node.type == "chat_input":
                trigger_node.set_value(trigger.get("value", ""))
            elif hasattr(trigger_node, "click"):
                trigger_node.click()
            else:
                trigger_node.set_value(True)
        except AppTestError as exc:
            raise AgentInteractError("invalid_widget_value", str(exc)) from exc
        patched.append(trigger_node)

    if len(form_ids) > 1:
        raise AgentInteractError(
            "cross_form_batch",
            "A request may not change widgets from more than one form.",
        )
    if form_ids:
        form_id = next(iter(form_ids))
        submit = (
            trigger_node is not None
            and str(getattr(trigger_node, "form_id", "") or "") == form_id
        )
        if not submit:
            raise AgentInteractError(
                "form_submit_required",
                "Form fields must be sent with exactly one of that form's submit triggers.",
            )
    return patched


def _find_widget(tree: ElementTree, key: str) -> Widget:
    matches = [
        node
        for node in tree
        if isinstance(node, Widget)
        and (node.key == key or getattr(node, "id", None) == key)
    ]
    if len(matches) != 1:
        raise AgentInteractError(
            "unknown_key",
            f"No addressable widget found for key {key!r}.",
        )
    return matches[0]


def _assert_can_set(node: Widget) -> None:
    if getattr(node.proto, "disabled", False):
        raise AgentInteractError(
            "disabled_widget",
            f"Widget {node.key or node.id!r} is disabled.",
        )


def _pages_payload(
    app_session: AppSession,
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    pages_info = app_session._pages_manager.get_pages()
    pages = [_page_entry(info) for info in pages_info.values()]
    current_hash = app_session._pages_manager.current_page_script_hash
    current = pages_info.get(current_hash)
    if current is None and pages_info:
        current = next(iter(pages_info.values()))
    page = (
        _page_entry(current) if current is not None else {"url_path": "", "title": ""}
    )
    if not pages:
        pages = [page]
    return pages, page


def _page_entry(info: Mapping[str, Any]) -> dict[str, Any]:
    url_path = str(info.get("url_pathname") or "")
    title = str(info.get("page_name") or "").replace("_", " ")
    entry: dict[str, Any] = {"url_path": url_path, "title": title}
    icon = info.get("icon")
    if icon:
        entry["icon"] = icon
    return entry
