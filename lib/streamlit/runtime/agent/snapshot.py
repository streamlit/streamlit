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
from typing import TYPE_CHECKING, Any, Final, NamedTuple, cast

from streamlit import config
from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.proto.RootContainer_pb2 import RootContainer
from streamlit.runtime.agent import json_encoding
from streamlit.runtime.state.common import user_key_from_element_id
from streamlit.runtime.state.session_state import SCRIPT_RUN_WITHOUT_ERRORS_KEY

if TYPE_CHECKING:
    from collections.abc import Callable

    from google.protobuf.message import Message

    from streamlit.proto.Block_pb2 import Block as BlockProto
    from streamlit.proto.Element_pb2 import Element as ElementProto
    from streamlit.runtime.state.session_state import SessionState

_LOGGER: Final = get_logger(__name__)

SCHEMA_VERSION: Final = 1


def _preview_row_limit() -> int:
    """Rows included in a `data.preview`, from `server.agentPreviewRows`.

    The default is large enough that most filtered tables are reported complete
    and need no second request, and small enough that a page of them does not
    dominate the response. A preview must never look like the complete answer
    to an aggregate question, which is what `data.complete` says outright.
    """
    return max(0, int(config.get_option("server.agentPreviewRows")))


# Commands whose whole contribution is layout or styling: a placeholder nobody
# filled, blank space, and style-only HTML. See `_SnapshotBuilder._is_contentless`.
_CONTENTLESS_TYPES: Final = {"empty", "space", "html"}

_DATA_SUMMARY_KEY: Final = "data_summary"

# Widgets whose wire value is text. Their serializer is what turns a stored
# Python value into that text -- a `format_func` label, an ISO date -- so a
# value reported through it is one a request can send back, whether or not the
# widget registered an option list.
_STRING_WIRE_TYPES: Final = {"string_value", "string_array_value"}

# What a Plotly template can add to a figure's content rather than its styling,
# such as a "DRAFT" annotation. Kept when the rest of the template is dropped.
_TEMPLATE_CONTENT: Final = ("annotations", "shapes", "images")

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
    # The options this element advertised, so the next request can be checked
    # against what the client was offered. The widget registry carries options
    # for most selection widgets, but not for `st.select_slider` and not for a
    # trigger such as `st.menu_button`.
    options: list[Any] | None
    # Whether a value may also be something not in `options`, as with
    # `accept_new_options`. The options still say which numbers name one.
    options_open: bool
    # The fragment this element lives in, if any. A request that targets it is
    # scoped to that fragment, the way the browser scopes a widget change.
    fragment_id: str | None
    # Whether the element is inside an open `st.dialog`. Only a rerun scoped
    # to the dialog's fragment keeps it open, so a request that cannot be
    # scoped that way would discard what it sent to the dialog.
    in_dialog: bool


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
        # Dialogs cannot nest, so a flag is enough to track the one being
        # serialized.
        self._in_dialog = False

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
        to the parent instead of nesting under a wrapper node, and because an
        element that carries nothing is dropped entirely.
        """
        if node.element is None:
            return self._serialize_container(node, inherited_support)

        if self._is_contentless(node):
            return []

        return [self._serialize_element(node, inherited_support)]

    @staticmethod
    def _is_contentless(node: _Node) -> bool:
        """True for an element that would serialize to nothing but its name.

        `st.empty()` reserves a slot and `st.space()` adds blank space, so an
        unfilled one of either says only "there is nothing here", which is what
        its absence says too, and on a typical page they are a large share of
        the nodes.

        Checked against the props rather than the name alone, so either command
        gaining something meaningful to say starts being reported again.
        """
        return node.description.get("type") in _CONTENTLESS_TYPES and not (
            node.description.get("props") or node.description.get("key")
        )

    def _serialize_container(
        self, node: _Node, inherited_support: str | None = None
    ) -> list[dict[str, Any]]:
        support = node.description.get("support") or inherited_support
        # A container that cannot be driven cannot have drivable contents.
        # Without this, `actions` would advertise children that the container's
        # own `support` denies, and the document would contradict itself.
        is_dialog = node.description.get("type") == "dialog"
        if is_dialog:
            self._in_dialog = True
        children = self.serialize_children(node, support)
        if is_dialog:
            self._in_dialog = False

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
        if (
            description["type"] == "container"
            and not props
            and not description.get("key")
            and len(children) == 1
        ):
            # A layout wrapper with one child and nothing configured carries no
            # meaning of its own. An authored key is a name the author gave it.
            return children

        result = self._base(description, inherited_support)
        self._note_fragment(node, result)

        # A container can be a widget itself: `st.tabs(on_change="rerun")`
        # registers one whose value is the open tab. Without this it would be
        # keyed in the tree but missing from `actions`, and the views behind its
        # other tabs would be unreachable.
        action = description.get("action")
        if action and (element_id := description.get("key")):
            value = self._widget_value(element_id)
            # As for elements, a trigger's value only means anything while set.
            if action == "value" or value:
                result["value"] = value
        self._record_state(description, inherited_support, None, node.fragment_id)

        result["children"] = children
        return [result]

    def _note_fragment(self, node: _Node, result: dict[str, Any]) -> None:
        """Report the fragment a node belongs to, if it belongs to one."""
        if node.fragment_id is None:
            return
        result["fragment"] = node.fragment_id

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
        if element_id and action and not _is_write_only(description):
            options = (description.get("props") or {}).get("options")
            value = self._widget_value(
                element_id, options=options if isinstance(options, list) else None
            )
            if action == "value" or value:
                # A trigger's value only means anything while it is set, and it
                # resets right after the run that observed it.
                result["value"] = value

        # A command whose payload does not carry its table supplies the summary
        # itself: `st.map` emits a generated Deck.gl spec.
        if _DATA_SUMMARY_KEY in description:
            data = description[_DATA_SUMMARY_KEY] or {}
        else:
            data = _element_data(proto_field, payload) or {}
        if data_url := description.get("data_url"):
            # A fetch-now handle for the complete data, registered while the
            # script ran. Do not persist it: the media file is reference
            # counted against the session and collected once the element that
            # produced it stops rendering.
            data["url"] = data_url
        elif data.get("complete") is False:
            # Incomplete with nowhere to fetch the rest. Unless the data block
            # already says why, the buffer was too large to hold a second copy
            # of; say so rather than leaving a client to infer it from a
            # missing key.
            data.setdefault("unavailable", "too_large_to_serve")
        if data:
            result["data"] = data

        form_id = getattr(payload, "form_id", "") if payload is not None else ""
        if form_id and element_id:
            result["form_id"] = form_id

        self._record_state(
            description, inherited_support, form_id or None, node.fragment_id
        )
        return result

    def _record_state(
        self,
        description: dict[str, Any],
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
        # What a request may choose from: a trigger's choices, such as
        # `st.menu_button`'s, and the options of a widget that registers none
        # of its own. Not a limit for a widget that accepts new options.
        options = props.get("options")
        if description["type"] == "feedback" and isinstance(options, str):
            # `st.feedback` names its option set, and its value is an index
            # into it.
            from streamlit.elements.widgets.feedback import _get_num_options

            count = _get_num_options(cast("Any", options))
            options = [str(index) for index in range(count)]
        actionable = bool(action) and not support and not disabled

        self.element_states[element_id] = ElementState(
            actionable=actionable,
            disabled=disabled,
            support=support,
            form_id=form_id,
            options=options if isinstance(options, list) else None,
            options_open=bool(props.get("accept_new_options")),
            fragment_id=fragment_id,
            in_dialog=self._in_dialog,
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

    def _widget_value(
        self, element_id: str, *, options: list[Any] | None = None
    ) -> Any:
        """Read a widget's live value, in the form a request may send back.

        For a widget with a fixed option set, ``st.session_state`` holds the
        author's Python option while the accepted wire value is the
        ``format_func``-formatted string. Reporting the raw option would make
        `value` unusable as input: a client that echoes it back gets
        `invalid_value`, and `st.pills(options=[1, 12], format_func=month_name)`
        reads `12` but only accepts `"December"`.

        The widget's own serializer is the mapping the runtime will apply in
        reverse, so it is what keeps read and write in the same space. It is
        used for every widget with an option list, whether the registry holds
        the list or only the snapshot lists it (`options`), as for
        `st.select_slider`. It is also used for a widget whose wire value is
        text when what it holds is not plain JSON already -- a date becomes its
        ISO string. Others -- numbers, booleans, temporal sliders,
        `st.feedback`'s integer -- are reported as their Python value in JSON,
        which a request may also send.

        A value typed into a widget that accepts new options is already its own
        wire form. The serializer runs `format_func` on it anyway, so echoing
        that back would format it again on every round trip; only a serialized
        value that is one of the options is reported in that form.
        """
        if self._session_state is None:
            return None
        try:
            value = self._session_state[element_id]
        except Exception:
            return None

        metadata = self._session_state._new_widget_state.widget_metadata.get(element_id)
        if options is None and metadata is not None:
            options = metadata.formatted_options
        if metadata is not None and (
            options is not None
            or (
                metadata.value_type in _STRING_WIRE_TYPES
                and not (value is None or isinstance(value, (str, int, float)))
            )
        ):
            try:
                serialized = metadata.serializer(value)
                if not isinstance(value, (list, tuple)) and isinstance(
                    serialized, list
                ):
                    # Some single-select widgets serialize to a one-item list.
                    # Keep the stored value's own shape, so a single choice
                    # reads back as a single choice.
                    serialized = serialized[0] if serialized else None
                value = _keep_typed(value, serialized, options)
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


def _keep_typed(stored: Any, serialized: Any, options: list[Any] | None) -> Any:
    """The serialized value, except where it formats text that is no option."""
    if options is None:
        return serialized
    if (
        isinstance(stored, (list, tuple))
        and isinstance(serialized, list)
        and len(stored) == len(serialized)
    ):
        return [
            label if label in options or not isinstance(item, str) else item
            for item, label in zip(stored, serialized, strict=True)
        ]
    if isinstance(stored, str) and serialized not in options:
        return stored
    return serialized


def _fallback_description(proto_field: str, payload: Message | None) -> dict[str, Any]:
    """Describe an element whose command has no agent-API description yet.

    Named after the proto field rather than a command, so a client can tell a
    coverage gap from a real command name, and carrying its scalar proto fields
    as props so the element is not silently empty -- except a widget's value
    and default. Those may be a password, which must never appear in a
    snapshot, and a described widget reports its value through `value` anyway.
    """
    element_id = getattr(payload, "id", "") if payload is not None else ""
    skipped = {"id", "form_id", "set_value"}
    if element_id:
        # A widget: its value and default are state, not construction.
        skipped |= {"value", "default"}

    props: dict[str, Any] = {}
    if payload is not None:
        for descriptor, value in payload.ListFields():
            if descriptor.message_type is None and descriptor.name not in skipped:
                props[descriptor.name] = json_encoding.to_json_value(value)

    description: dict[str, Any] = {"type": proto_field, "props": props}
    if element_id:
        description["key"] = element_id
    return description


def _is_write_only(description: dict[str, Any]) -> bool:
    """Whether an element's value may be set but must never be reported.

    Responses are logged and kept in a model's context, so a password the app
    defaulted or the client typed must not come back out.
    """
    props = description.get("props") or {}
    return description.get("type") == "text_input" and props.get("type") == "password"


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
            data = summarize_arrow(payload.lazy_data.initial_chunk.data)
            if data is not None:
                # The emitted chunk is the preview; the authoritative row count
                # comes from the source rather than the chunk. The rest is
                # only fetched by a browser as it scrolls, so nothing serves it.
                data["complete"] = False
                data["unavailable"] = "lazy_loading"
                if payload.lazy_data.HasField("row_count"):
                    data["row_count"] = payload.lazy_data.row_count
                data["preview"]["truncated"] = True
            return data
        return summarize_arrow(payload.arrow_data.data)

    if proto_field == "table":
        return summarize_arrow(payload.arrow_data.data)

    if proto_field == "vega_lite_chart":
        buffers = agent_spec.vega_arrow_buffers(payload)
        if len(buffers) > 1:
            data = {"complete": False, "unavailable": "multiple_datasets"}
        else:
            data = (summarize_arrow(buffers[0]) if buffers else None) or {}
        spec = _parse_json(payload.spec)
        if isinstance(spec, dict):
            # The built-in charts write 0 for a size the author left unset,
            # which means "fill the container", not a size.
            spec = {
                name: value
                for name, value in spec.items()
                if not (name in {"width", "height"} and value == 0)
            }
        if spec is not None:
            data["spec"] = spec
        return data or None

    if proto_field in {"plotly_chart", "echarts_chart"}:
        # These take a figure or an option object rather than a dataframe, so
        # the values are inside the specification and there is no separate
        # table to fetch. Saying so is the point: `complete` means a client
        # already has everything, so it does not go looking for a `url`.
        return _figure_data(_parse_json(payload.spec))

    if proto_field == "deck_gl_json_chart":
        spec = _parse_json(payload.json)
        if spec is None:
            return None
        map_data = {"spec": spec, "complete": True}
        if (row_count := _deck_gl_row_count(spec)) is not None:
            map_data["row_count"] = row_count
        return map_data

    return None


def _figure_data(spec: Any) -> dict[str, Any] | None:
    """Describe a chart whose values live inside its own specification.

    The theme is dropped, because it is weight without meaning for a non-visual
    client: Plotly's `layout.template` is about nine tenths of a small figure.
    Dropping it is named in `spec_omitted`, so a client can tell a trimmed
    figure from one the app never configured. A template can also carry
    content, such as a "DRAFT" annotation, and that is kept.

    Nothing else is dropped, at any size. For these charts the specification
    holds the values, so trimming further would remove the only part worth
    reading, and a figure large enough to matter is large because it plots a lot
    of data -- the same bytes the app already sends its own client. A ceiling
    here would trade a complete answer for a smaller response.
    """
    if spec is None:
        return None

    data: dict[str, Any] = {}

    if (
        isinstance(spec, dict)
        and isinstance(spec.get("layout"), dict)
        and "template" in spec["layout"]
    ):
        template = spec["layout"]["template"]
        template_layout = template.get("layout") if isinstance(template, dict) else None
        if not isinstance(template_layout, dict):
            template_layout = {}
        content = {
            name: template_layout[name]
            for name in _TEMPLATE_CONTENT
            if template_layout.get(name)
        }
        layout = {k: v for k, v in spec["layout"].items() if k != "template"}
        if content:
            layout["template"] = {"layout": content}
            data["spec_omitted"] = [
                f"layout.template.{name}" for name in template if name != "layout"
            ] + [
                f"layout.template.layout.{name}"
                for name in template_layout
                if name not in content
            ]
        else:
            data["spec_omitted"] = ["layout.template"]
        spec = {**spec, "layout": layout}

    data["spec"] = _expand_typed_arrays(spec)
    data["complete"] = True
    return data


def _expand_typed_arrays(value: Any) -> Any:
    """Expand Plotly's base64 typed arrays into lists of numbers, at any depth.

    Plotly writes a NumPy array as `{"dtype": "f8", "bdata": "<base64>"}`,
    which a browser decodes and a language model cannot read. Those arrays are
    the values that make a figure `complete`, so they are reported as numbers,
    at the cost of a longer specification.
    """
    if isinstance(value, list):
        return [_expand_typed_arrays(item) for item in value]
    if not isinstance(value, dict):
        return value
    if (
        isinstance(value.get("bdata"), str)
        and isinstance(value.get("dtype"), str)
        and set(value) <= {"bdata", "dtype", "shape"}
    ):
        try:
            return _decode_typed_array(value)
        except Exception:
            _LOGGER.debug("Could not decode a Plotly typed array.", exc_info=True)
            return value
    return {name: _expand_typed_arrays(item) for name, item in value.items()}


def _decode_typed_array(value: dict[str, Any]) -> Any:
    import base64

    import numpy as np

    # Plotly.js reads these buffers as little-endian.
    dtype = np.dtype(value["dtype"]).newbyteorder("<")
    array = np.frombuffer(base64.b64decode(value["bdata"]), dtype=dtype)
    if shape := value.get("shape"):
        dims = shape if isinstance(shape, list) else str(shape).split(",")
        array = array.reshape([int(dim) for dim in dims])
    # Through the JSON encoding, so a NaN in a float array becomes null.
    return json_encoding.to_json_value(array.tolist())


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
    """Parse a chart or map specification for the response.

    `NaN` and infinities become null, as they do in table previews: the
    specifications are written with Python's lenient encoder, so a missing
    value in a layer's data arrives as `NaN`, which strict JSON cannot carry.
    """
    if not value:
        return None
    try:
        return json.loads(value, parse_constant=lambda _constant: None)
    except json.JSONDecodeError:
        return None


def summarize_arrow(arrow_bytes: bytes) -> dict[str, Any] | None:
    """Describe an Arrow buffer: schema, size, and a bounded row preview."""
    if not arrow_bytes:
        return None

    import pyarrow as pa

    limit = _preview_row_limit()
    try:
        table = pa.RecordBatchStreamReader(arrow_bytes).read_all()
        rows = arrow_rows(table, 0, limit)
    except Exception:
        # Any failure, not just a malformed stream: an element without a
        # summary costs far less than a failed snapshot, or a failed command
        # for `st.map`, which summarizes its table while the script runs.
        _LOGGER.debug("Could not summarize an Arrow payload.", exc_info=True)
        return None

    columns = arrow_columns(table)
    # `complete` is whether `preview.rows` is the whole dataset. It sits at
    # the top of `data` because that is the first question a client asks.
    # `truncated` is the inverse, for readers that look inside `preview`.
    complete = table.num_rows <= limit
    return {
        "columns": columns,
        "row_count": table.num_rows,
        "column_count": len(columns),
        "complete": complete,
        "preview": {
            "truncated": not complete,
            # Rows are values in `columns` order rather than objects, because
            # repeating the column names on every row is most of a preview's
            # size once it gets long. Types and nested cells survive, which a
            # CSV blob would cost without coming out smaller.
            "rows": rows,
        },
    }


def arrow_columns(table: Any) -> list[dict[str, str]]:
    """An Arrow table's columns with their types.

    Every column the bytes behind `data.url` carry, under the same names, so
    the reported schema is the schema of what a client fetches. That includes
    an unnamed, non-range index, which pandas stores as `__index_level_N__` and
    `st.dataframe` displays.
    """
    return [
        {"name": name, "type": str(dtype)}
        for name, dtype in zip(table.schema.names, table.schema.types, strict=True)
    ]


def arrow_rows(table: Any, offset: int, limit: int) -> list[list[Any]]:
    """Up to ``limit`` rows from ``offset``, as JSON values in column order.

    By position rather than by name, so a table with two columns of the same
    name keeps both.
    """
    return [
        [json_encoding.to_json_value(cell) for cell in row]
        for row in zip(
            *(column.to_pylist() for column in table.slice(offset, limit).columns),
            strict=True,
        )
    ]


def media_file_ids(document: dict[str, Any], *, media_path: str) -> frozenset[str]:
    """The IDs of the media files a snapshot references, before rebasing."""
    media_prefix = media_path.rstrip("/") + "/"
    ids: set[str] = set()

    def collect(value: Any) -> Any:
        for item in value if isinstance(value, list) else [value]:
            if isinstance(item, str) and item.startswith(media_prefix):
                ids.add(media_file_id(item))
        return value

    _map_media_urls(document, collect)
    return frozenset(ids)


def media_file_id(url: str) -> str:
    """The file ID in a media URL, relative or not, or in a bare ID.

    Media storage names a file ``<id><extension>`` under its endpoint.
    """
    name = url.split("?", 1)[0].rstrip("/").rsplit("/", 1)[-1]
    return name.split(".", 1)[0]


def rebase_media_urls(
    document: dict[str, Any], *, media_path: str, prefix: str
) -> None:
    """Prefix a snapshot's media URLs with the way back to the app's root, in place.

    Media storage hands out URLs relative to the app's root (``/media/<id>``),
    which a browser resolves against its own base path. A client of this API
    has no base path to resolve against, so the URL has to say how to reach the
    root: as is, behind ``server.baseUrlPath`` or a hosting prefix, a table's
    ``data.url`` is a 404 or a login redirect.

    Only ``data.url`` and the ``url``, ``src``, and ``avatar`` props are
    touched, and only values under ``media_path``, so an external link an app
    displays is never rewritten.
    """
    media_prefix = media_path.rstrip("/") + "/"

    def rebase(value: Any) -> Any:
        if isinstance(value, str) and value.startswith(media_prefix):
            return prefix + value
        if isinstance(value, list):
            return [rebase(item) for item in value]
        return value

    _map_media_urls(document, rebase)


def _map_media_urls(document: dict[str, Any], transform: Callable[[Any], Any]) -> None:
    """Replace every field that can hold a media URL with ``transform(value)``.

    These are ``data.url`` and the ``url``, ``src``, and ``avatar`` props; a
    value may be a list, as for several images.
    """

    def walk(node: dict[str, Any]) -> None:
        data = node.get("data")
        if isinstance(data, dict) and "url" in data:
            data["url"] = transform(data["url"])
        props = node.get("props")
        if isinstance(props, dict):
            for name in ("url", "src", "avatar"):
                if name in props:
                    props[name] = transform(props[name])
        for child in node.get("children") or []:
            walk(child)

    tree = document.get("tree")
    if isinstance(tree, dict):
        walk(tree)


def build_snapshot(
    *,
    session_id: str,
    messages: list[ForwardMsg],
    session_state: SessionState | None,
    query_params: dict[str, list[str]],
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
    if compile_error:
        _add_compile_error(children, messages)

    pages, current_page = _pages(messages, new_session)

    document: dict[str, Any] = {
        "schema_version": SCHEMA_VERSION,
        "session_id": session_id,
        # Two signals, not one: an app's `on_script_error` handler can suppress
        # the error display, which only the run's own flag still reports, and
        # an exception raised inside a fragment is rendered while the run still
        # reports success.
        "status": "error"
        if compile_error or _run_failed(session_state) or builder.saw_uncaught_exception
        else "ready",
        "observed_at": datetime.datetime.now(datetime.UTC)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "app_title": _app_title(messages, new_session),
        "page": current_page,
        "pages": pages,
        "query_params": query_params,
        "tree": {"type": "root", "children": children},
        "actions": builder.actions,
    }

    if builder.undescribed_types:
        # Commands that have not been given an agent-API description yet.
        # Reported so a gap is visible to the caller instead of looking like a
        # real command name.
        document["undescribed_types"] = sorted(builder.undescribed_types)

    return Snapshot(document=document, element_states=builder.element_states)


def _run_failed(session_state: SessionState | None) -> bool:
    """Whether the runtime recorded the last run as raising."""
    if session_state is None:
        return False
    try:
        return session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY] is False
    except KeyError:
        return False


def _add_compile_error(
    children: list[dict[str, Any]], messages: list[ForwardMsg]
) -> None:
    """Report a compile error where an uncaught exception would be.

    A browser shows it as an overlay from a session event rather than as an
    element, so it never reaches the tree. Without it, a client that edited a
    script into a syntax error would see an empty app and no reason why.
    """
    event = _last_message(messages, "session_event")
    if event is None or not event.session_event.HasField(
        "script_compilation_exception"
    ):
        return
    exception = event.session_event.script_compilation_exception
    main = next((child for child in children if child.get("type") == "main"), None)
    if main is None:
        return
    props: dict[str, Any] = {
        "type": exception.type or None,
        "message": exception.message or None,
        "stack_trace": list(exception.stack_trace) or None,
        "uncaught": True,
    }
    main.setdefault("children", []).append(
        {
            "type": "exception",
            "props": {
                name: value for name, value in props.items() if value is not None
            },
        }
    )


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

    # An app that declares no pages lists only its main script, under whatever
    # page name the request asked for. Its one real page is the default one.
    single_page = navigation is None and len(app_pages) == 1

    pages: list[dict[str, Any]] = []
    current_page: dict[str, Any] = {}
    for page in app_pages:
        entry: dict[str, Any] = {
            "url_path": "" if single_page else page.url_pathname,
            "title": default_title if single_page else page.page_name or default_title,
        }
        if page.icon:
            entry["icon"] = page.icon
        pages.append(entry)
        if page.page_script_hash == current_hash:
            current_page = entry

    return pages, current_page
