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

"""Turn a run's ForwardMsgs into the JSON snapshot an agent reads.

Each command already described itself when it emitted its element (see
``elements/lib/agent_spec.py``), so this module does not interpret protos. It
merges the run's deltas by ``delta_path`` the way the frontend does, then fills
in the two things a command could not know yet:

- ``value``, read from reconciled session state, because proto defaults stop
  being accurate after the first interaction.
- ``data``, the derived facts about a dataframe or chart, bounded by the
  response budget.
"""

from __future__ import annotations

import datetime
import json
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any, Final, NamedTuple

from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.agent import json_encoding
from streamlit.runtime.state.common import user_key_from_element_id

if TYPE_CHECKING:
    from google.protobuf.message import Message

    from streamlit.proto.Block_pb2 import Block as BlockProto
    from streamlit.proto.Element_pb2 import Element as ElementProto
    from streamlit.runtime.state.session_state import SessionState

_LOGGER: Final = get_logger(__name__)

SCHEMA_VERSION: Final = 1

# Rows included in a `data.preview`. Large enough that most filtered tables are
# reported complete and need no second request, small enough that a page of
# them does not dominate the response. A preview must never look like the
# complete answer to an aggregate question, which is what `data.complete` says
# outright.
_PREVIEW_ROW_LIMIT: Final = 100

_ROOT_CONTAINER_NAMES: Final = {
    RootContainer.MAIN: "main",
    RootContainer.SIDEBAR: "sidebar",
    RootContainer.EVENT: "event",
    RootContainer.BOTTOM: "bottom",
}


@dataclass
class _Node:
    """A merged tree node: either a container or a single element."""

    block: BlockProto | None = None
    element: ElementProto | None = None
    # What the command said about itself, from ForwardMsgMetadata.agent_props.
    description: dict[str, Any] = field(default_factory=dict)
    # The fragment that emitted this node, when one did. Acting on an element
    # inside a fragment reruns only that fragment, so this decides both the
    # scope of the next request and which parts of the tree are freshly
    # rendered.
    fragment_id: str | None = None
    # Root containers have a fixed name rather than a proto.
    root_name: str | None = None
    children: dict[int, _Node] = field(default_factory=dict)

    @property
    def is_container(self) -> bool:
        return self.element is None


def merge_deltas(messages: list[ForwardMsg]) -> _Node:
    """Merge a run's deltas into a tree of the four root containers.

    Mirrors the frontend: walk ``delta_path``, creating placeholder containers
    for positions not claimed yet, and write the node at the final index. A
    block arriving where a placeholder already collected children adopts them.
    """
    root = _Node(
        root_name="root",
        children={
            index: _Node(root_name=name)
            for index, name in _ROOT_CONTAINER_NAMES.items()
        },
    )

    for msg in messages:
        if not msg.HasField("delta"):
            continue

        description = (
            agent_spec.decode(msg.metadata.agent_props)
            if msg.metadata.HasField("agent_props")
            else {}
        )

        delta_type = msg.delta.WhichOneof("type")
        # Set on every delta written while a fragment was running, which is how
        # a partial rerun says what it owns.
        fragment_id = msg.delta.fragment_id or None
        if delta_type == "new_element":
            node = _Node(
                element=msg.delta.new_element,
                description=description,
                fragment_id=fragment_id,
            )
        elif delta_type == "add_block":
            node = _Node(
                block=msg.delta.add_block,
                description=description,
                fragment_id=fragment_id,
            )
        else:
            # Transient elements (spinners) report progress for a run that has
            # already finished by the time a snapshot is built.
            continue

        delta_path = list(msg.metadata.delta_path)
        if not delta_path:
            continue

        parent = root
        for index in delta_path[:-1]:
            child = parent.children.get(index)
            if child is None or not child.is_container:
                child = _Node()
                parent.children[index] = child
            parent = child

        position = delta_path[-1]
        if node.is_container:
            existing = parent.children.get(position)
            if existing is not None:
                node.children = existing.children
        parent.children[position] = node

    return root


class ElementState(NamedTuple):
    """What the last snapshot knew about an addressable element.

    The next request is validated against this rather than against live widget
    metadata, because metadata outlives the widget: a control that stopped
    rendering (a page switch, a collapsed branch) still has metadata, so
    metadata alone cannot answer "does this control still exist". Recording
    *why* an element is not actionable is what lets the rejection name the
    actual reason instead of blaming the page.
    """

    actionable: bool
    disabled: bool
    support: str | None
    # The owning st.form, for elements inside one. Form membership exists only
    # on the emitted element, not in the runtime's widget registry.
    form_id: str | None
    # What this element advertised, so the next request can be checked against
    # what the client was actually offered. The widget registry carries options
    # for selection widgets, but not bounds, not a trigger's options, and not
    # the arity of a range, so the snapshot is the only place that has them.
    options: list[Any] | None
    min_value: Any
    max_value: Any
    value: Any
    # The fragment this element lives in, if any. A request that targets it is
    # scoped to that fragment, the way the browser scopes a widget change.
    fragment_id: str | None


@dataclass
class Snapshot:
    """A serialized snapshot plus the bookkeeping the next request needs."""

    document: dict[str, Any]
    element_states: dict[str, ElementState]


class _SnapshotBuilder:
    def __init__(self, session_state: SessionState | None) -> None:
        self._session_state = session_state
        self.actions: list[dict[str, str]] = []
        self.element_states: dict[str, ElementState] = {}
        self.undescribed_types: set[str] = set()
        self.saw_uncaught_exception = False
        self.fragment_ids: set[str] = set()

    def serialize_children(
        self, node: _Node, inherited_support: str | None = None
    ) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for _, child in sorted(node.children.items()):
            result.extend(self._serialize(child, inherited_support))
        return result

    def _serialize(
        self, node: _Node, inherited_support: str | None
    ) -> list[dict[str, Any]]:
        """Serialize one node.

        Returns a list because a transparent container contributes its children
        to the parent instead of nesting under a wrapper node.
        """
        if node.element is not None:
            return [self._serialize_element(node, inherited_support)]
        return self._serialize_container(node, inherited_support)

    def _serialize_container(
        self, node: _Node, inherited_support: str | None = None
    ) -> list[dict[str, Any]]:
        support = node.description.get("support") or inherited_support
        # A container that cannot be driven cannot have drivable contents.
        # Without this, `actions` would advertise children that the container's
        # own `support` denies, and the document would contradict itself.
        children = self.serialize_children(node, support)

        if node.root_name is not None:
            return [{"type": node.root_name, "children": children}]

        if node.block is None:
            # A position claimed by a descendant delta before its own block
            # arrived, which happens for containers that never rendered.
            return children

        description = node.description
        if not description:
            # A container command that has no agent-API description yet. Report
            # the proto field so it stays visible rather than disappearing.
            proto_field = node.block.WhichOneof("type") or "container"
            self.undescribed_types.add(proto_field)
            return [{"type": proto_field, "children": children}]

        if description.get("transparent"):
            return children

        props = description.get("props") or {}
        if description["type"] == "container" and not props and len(children) == 1:
            # A layout wrapper with one child and nothing configured carries no
            # meaning of its own.
            return children

        result = self._base(description, inherited_support)
        self._note_fragment(node, result)

        # A container can be a widget itself: `st.tabs(on_change="rerun")`
        # registers one whose value is the open tab. Without this it would be
        # keyed in the tree but missing from `actions`, and the views behind its
        # other tabs would be unreachable.
        if description.get("action") and (element_id := description.get("key")):
            result["value"] = self._widget_value(element_id)
        self._record_state(
            description, result, inherited_support, None, node.fragment_id
        )

        result["children"] = children
        return [result]

    def _note_fragment(self, node: _Node, result: dict[str, Any]) -> None:
        """Report the fragment a node belongs to, and remember it was seen."""
        if node.fragment_id is None:
            return
        result["fragment"] = node.fragment_id
        self.fragment_ids.add(node.fragment_id)

    def _serialize_element(
        self, node: _Node, inherited_support: str | None = None
    ) -> dict[str, Any]:
        element = node.element
        assert element is not None  # noqa: S101 - guarded by the caller
        proto_field = element.WhichOneof("type") or "unknown"
        payload = getattr(element, proto_field, None)

        description = node.description
        if not description:
            self.undescribed_types.add(proto_field)
            description = _fallback_description(proto_field, payload)

        if proto_field == "exception":
            # `st.exception` is a display command, so an app rendering an error
            # it caught and handled is not a failed run. Only the runtime's own
            # error display means the script did not finish.
            props = description.get("props") or {}
            self.saw_uncaught_exception |= bool(props.get("uncaught", True))

        result = self._base(description, inherited_support)
        self._note_fragment(node, result)
        element_id = description.get("key")

        action = description.get("action")
        if element_id and action:
            value = self._widget_value(element_id)
            if action == "value" or value:
                # A trigger's value only means anything while it is set, and it
                # resets right after the run that observed it.
                result["value"] = value

        data = _element_data(proto_field, payload) or {}
        if data_url := description.get("data_url"):
            # A fetch-now handle for the complete data, registered while the
            # script ran. Do not persist it: the media file is reference
            # counted against the session and collected once the element that
            # produced it stops rendering.
            data["url"] = data_url
        elif data.get("complete") is False:
            # Incomplete with nowhere to fetch the rest. The only way to reach
            # this is a buffer too large to hold a second copy of, so say so
            # rather than leaving a client to infer it from a missing key.
            data["unavailable"] = "too_large_to_serve"
        if data:
            result["data"] = data

        form_id = getattr(payload, "form_id", "") if payload is not None else ""
        if form_id and element_id:
            result["form_id"] = form_id

        self._record_state(
            description, result, inherited_support, form_id or None, node.fragment_id
        )
        return result

    def _record_state(
        self,
        description: dict[str, Any],
        result: dict[str, Any],
        inherited_support: str | None,
        form_id: str | None,
        fragment_id: str | None = None,
    ) -> None:
        """Record what a node offers, and list it in `actions` if it is usable.

        Recorded for every keyed node, not just the usable ones, so the next
        request can be told what is actually wrong with a key rather than being
        told it is on the wrong page.
        """
        element_id = description.get("key")
        if not element_id:
            return

        props = description.get("props") or {}
        action = description.get("action")
        support = description.get("support") or inherited_support
        disabled = bool(props.get("disabled"))
        options = props.get("options")
        actionable = bool(action) and not support and not disabled

        self.element_states[element_id] = ElementState(
            actionable=actionable,
            disabled=disabled,
            support=support,
            form_id=form_id,
            options=options if isinstance(options, list) else None,
            min_value=props.get("min_value"),
            max_value=props.get("max_value"),
            value=result.get("value"),
            fragment_id=fragment_id,
        )
        if actionable:
            self.actions.append(
                {
                    "key": user_key_from_element_id(element_id) or element_id,
                    "kind": str(action),
                }
            )

    def _base(
        self, description: dict[str, Any], inherited_support: str | None = None
    ) -> dict[str, Any]:
        """Build the node fields common to elements and containers."""
        result: dict[str, Any] = {"type": description["type"]}

        element_id = description.get("key")
        if element_id:
            # An authored key is the stable, readable identity; the generated
            # element ID is an opaque session-scoped handle.
            result["key"] = user_key_from_element_id(element_id) or element_id

        props = description.get("props") or {}
        if props:
            result["props"] = props
        # Repeated onto descendants of an unusable container, so a client never
        # has to walk up the tree to find out why a node is not in `actions`.
        if support := description.get("support") or inherited_support:
            result["support"] = support
        return result

    def _widget_value(self, element_id: str) -> Any:
        """Read a widget's live value, in the form a request may send back.

        For a widget with a fixed option set, ``st.session_state`` holds the
        author's Python option while the accepted wire value is the
        ``format_func``-formatted string. Reporting the raw option would make
        `value` unusable as input: a client that echoes it back gets
        `invalid_value`, and `st.pills(options=[1, 12], format_func=month_name)`
        reads `12` but only accepts `"December"`.

        The widget's own serializer is the mapping the runtime will apply in
        reverse, so it is what keeps read and write in the same space.
        """
        if self._session_state is None:
            return None
        try:
            value = self._session_state[element_id]
        except Exception:
            return None

        metadata = self._session_state._new_widget_state.widget_metadata.get(element_id)
        if metadata is not None and metadata.formatted_options is not None:
            try:
                serialized = metadata.serializer(value)
                if not isinstance(value, (list, tuple)) and isinstance(
                    serialized, list
                ):
                    # Some single-select widgets serialize to a one-item list.
                    # Keep the stored value's own shape, so a single choice
                    # reads back as a single choice.
                    serialized = serialized[0] if serialized else None
                value = serialized
            except Exception:
                _LOGGER.debug(
                    "Could not serialize the value of %s; reporting it as stored.",
                    element_id,
                    exc_info=True,
                )

        try:
            return json_encoding.to_json_value(value)
        except Exception:
            return None


def _fallback_description(proto_field: str, payload: Message | None) -> dict[str, Any]:
    """Describe an element whose command has no agent-API description yet.

    Named after the proto field rather than a command, so a client can tell a
    coverage gap from a real command name, and carrying only scalar fields so
    the element is not silently empty.
    """
    props: dict[str, Any] = {}
    if payload is not None:
        for descriptor, value in payload.ListFields():
            if descriptor.message_type is None and descriptor.name not in {
                "id",
                "form_id",
                "set_value",
            }:
                props[descriptor.name] = json_encoding.to_json_value(value)

    description: dict[str, Any] = {"type": proto_field, "props": props}
    element_id = getattr(payload, "id", "") if payload is not None else ""
    if element_id:
        description["key"] = element_id
    return description


def _element_data(proto_field: str, payload: Any) -> dict[str, Any] | None:
    """Describe the data an element carries, as derived facts rather than props.

    Kept out of a command's own description because how much to include is a
    response-budget decision, and because the Arrow buffer is only assembled by
    the time the element is emitted.

    ``payload`` is typed loosely because each branch narrows it to a different
    proto by way of ``proto_field``.
    """
    if payload is None:
        return None

    if proto_field == "dataframe":
        if payload.HasField("lazy_data"):
            data = _arrow_data(payload.lazy_data.initial_chunk.data)
            if data is not None:
                # The emitted chunk is the preview; the authoritative row count
                # comes from the source rather than the chunk.
                data["complete"] = False
                if payload.lazy_data.HasField("row_count"):
                    data["row_count"] = payload.lazy_data.row_count
                data["preview"]["truncated"] = True
            return data
        return _arrow_data(payload.arrow_data.data)

    if proto_field == "table":
        return _arrow_data(payload.arrow_data.data)

    if proto_field == "vega_lite_chart":
        # Inline data goes in `data`; the built-in charts and Altair use a
        # named dataset instead.
        arrow_bytes = payload.data.data or (
            payload.datasets[0].data.data if payload.datasets else b""
        )
        data = _arrow_data(arrow_bytes) or {}
        spec = _parse_json(payload.spec)
        if spec is not None:
            data["spec"] = spec
        return data or None

    if proto_field in {"plotly_chart", "echarts_chart"}:
        spec = _parse_json(payload.spec)
        # These take a figure or an option object rather than a dataframe, so
        # the values are inside the specification and there is no separate
        # table to fetch. Saying so is the point: `complete` means a client
        # already has everything, so it does not go looking for a `url`.
        return {"spec": spec, "complete": True} if spec is not None else None

    if proto_field == "deck_gl_json_chart":
        spec = _parse_json(payload.json)
        if spec is None:
            return None
        map_data = {"spec": spec, "complete": True}
        if (row_count := _deck_gl_row_count(spec)) is not None:
            map_data["row_count"] = row_count
        return map_data

    if proto_field == "metric" and payload.chart_data:
        return {"chart_data": list(payload.chart_data)}

    return None


def _deck_gl_row_count(spec: Any) -> int | None:
    """Count the points a Deck.gl specification plots, across its layers.

    The map's own row count is not on the proto, and a client should not have
    to walk layer JSON to learn how much it is looking at.
    """
    if not isinstance(spec, dict):
        return None

    layers = spec.get("layers")
    if not isinstance(layers, list):
        return None

    total = 0
    for layer in layers:
        rows = layer.get("data") if isinstance(layer, dict) else None
        if isinstance(rows, list):
            total += len(rows)
    return total


def _parse_json(value: str) -> Any:
    if not value:
        return None
    try:
        return json.loads(value)
    except json.JSONDecodeError:
        return None


def _arrow_data(arrow_bytes: bytes) -> dict[str, Any] | None:
    """Describe an Arrow buffer: schema, size, and a bounded row preview."""
    if not arrow_bytes:
        return None

    import pyarrow as pa

    try:
        table = pa.RecordBatchStreamReader(arrow_bytes).read_all()
    except pa.ArrowInvalid:
        return None

    columns = [
        (name, dtype)
        for name, dtype in zip(table.schema.names, table.schema.types, strict=True)
        if not _is_index_column(name)
    ]
    preview = table.slice(0, _PREVIEW_ROW_LIMIT)
    return {
        "columns": [{"name": name, "type": str(dtype)} for name, dtype in columns],
        "row_count": table.num_rows,
        "column_count": len(columns),
        # Whether `preview.rows` is the whole dataset. Stated at the top level
        # of `data` because "did I get everything?" is the first question a
        # client asks, and a flag nested inside `preview` is easy to miss.
        "complete": table.num_rows <= _PREVIEW_ROW_LIMIT,
        "preview": {
            "truncated": table.num_rows > _PREVIEW_ROW_LIMIT,
            "rows": [
                {
                    name: json_encoding.to_json_value(cell)
                    for name, cell in row.items()
                    if not _is_index_column(name)
                }
                for row in preview.to_pylist()
            ],
        },
    }


def _is_index_column(name: str) -> bool:
    """True for a column that only exists to carry a dataframe's index.

    pandas serializes a non-trivial index into the Arrow buffer as
    ``__index_level_N__``. It is positional bookkeeping rather than data, and
    reporting it would put a column in the snapshot that the app never
    displayed and that no author named.
    """
    return name.startswith("__index_level_") or name == "__index__"


def build_snapshot(
    *,
    session_id: str,
    messages: list[ForwardMsg],
    session_state: SessionState | None,
    query_params: dict[str, list[str]],
    rendered_fragments: list[str] | None = None,
    auto_rerun_intervals: dict[str, float] | None = None,
) -> Snapshot:
    """Build the complete snapshot document for the run that just settled."""
    tree = merge_deltas(messages)
    builder = _SnapshotBuilder(session_state)
    children = builder.serialize_children(tree)

    new_session = _last_message(messages, "new_session")
    compile_error = any(
        msg.WhichOneof("type") == "script_finished"
        and msg.script_finished == ForwardMsg.FINISHED_WITH_COMPILE_ERROR
        for msg in messages
    )

    pages, current_page = _pages(messages, new_session)

    document: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        # Two signals, not one: an app can suppress its error display, and an
        # exception raised inside a fragment is rendered while the run still
        # reports success.
        "status": "error"
        if compile_error or builder.saw_uncaught_exception
        else "ready",
        "observed_at": datetime.datetime.now(datetime.timezone.utc)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "app_title": _app_title(messages, new_session),
        "page": current_page,
        "pages": pages,
        "query_params": query_params,
        "tree": {"type": "root", "children": children},
        "actions": builder.actions,
    }

    if fragments := _fragments(
        builder.fragment_ids, rendered_fragments or [], auto_rerun_intervals or {}
    ):
        document["fragments"] = fragments

    if builder.undescribed_types:
        # Commands that have not been given an agent-API description yet.
        # Reported so a gap is visible to the caller instead of looking like a
        # real command name.
        document["undescribed_types"] = sorted(builder.undescribed_types)

    return Snapshot(document=document, element_states=builder.element_states)


def _fragments(
    seen: set[str],
    rendered: list[str],
    auto_rerun_intervals: dict[str, float],
) -> list[dict[str, Any]]:
    """Describe the fragments in the tree, and which the last run re-rendered.

    A partial rerun means the tree holds regions of different ages, so
    ``observed_at`` alone would overstate how current some of it is. `rendered`
    is what makes that legible: on a full run every fragment is rendered, and
    after a fragment-scoped interaction only the one that ran is.

    ``run_every`` is reported rather than acted on. The browser turns it into a
    timer; this interface has no clock of its own, so refreshing is the client's
    decision.
    """
    return [
        {
            "id": fragment_id,
            "rendered": not rendered or fragment_id in rendered,
            **(
                {"run_every": round(interval, 3)}
                if (interval := auto_rerun_intervals.get(fragment_id))
                else {}
            ),
        }
        for fragment_id in sorted(seen)
    ]


def _last_message(messages: list[ForwardMsg], msg_type: str) -> ForwardMsg | None:
    for msg in reversed(messages):
        if msg.WhichOneof("type") == msg_type:
            return msg
    return None


def _app_title(messages: list[ForwardMsg], new_session: ForwardMsg | None) -> str:
    """The whole app's title, from ``st.set_page_config(page_title=...)``.

    Kept separate from the current page's title. They are different things and
    conflating them makes ``page.title`` answer "which app am I in?" when every
    caller reads it as "which page am I on?".
    """
    page_config = _last_message(messages, "page_config_changed")
    if page_config is not None and page_config.page_config_changed.title:
        return str(page_config.page_config_changed.title)
    return str(new_session.new_session.name) if new_session is not None else ""


def _pages(
    messages: list[ForwardMsg], new_session: ForwardMsg | None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """List the app's pages and identify the current one by ``url_path``.

    ``st.navigation`` supersedes the page list in ``new_session``, so a later
    navigation message wins.
    """
    navigation = _last_message(messages, "navigation")
    if navigation is not None:
        app_pages = navigation.navigation.app_pages
        current_hash = navigation.navigation.page_script_hash
    elif new_session is not None:
        app_pages = new_session.new_session.app_pages
        current_hash = new_session.new_session.page_script_hash
    else:
        return [], {}

    default_title = ""
    if new_session is not None:
        # Streamlit derives a page's browser title from the script filename
        # when the author sets none.
        default_title = new_session.new_session.name

    pages: list[dict[str, Any]] = []
    current_page: dict[str, Any] = {}
    for page in app_pages:
        entry: dict[str, Any] = {
            "url_path": page.url_pathname,
            "title": page.page_name or default_title,
        }
        if page.icon:
            entry["icon"] = page.icon
        pages.append(entry)
        if page.page_script_hash == current_hash:
            current_page = entry

    return pages, current_page
