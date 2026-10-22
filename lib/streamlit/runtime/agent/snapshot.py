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
``elements/lib/agent_spec.py``), so this module does not interpret protos.
``tree`` merges the run's deltas by ``delta_path``. This walk then fills in
``value`` from ``widget_values``, because proto defaults stop being accurate
after the first interaction.

``data``, the derived facts about a table or chart, is read here from the
element's payload, or taken from the command's ``data_summary`` when the payload
does not carry its table. Its preview is bounded by ``server.agentPreviewRows``.
``url``, where the complete data is served, comes from the command's
description, and ``unavailable`` says why there is none when the preview is
not everything. A command's parameters stay in ``props``.
"""

from __future__ import annotations

import datetime as dt
import json
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final, Literal, NamedTuple, TypeAlias

from streamlit import config
from streamlit.elements.lib import agent_spec
from streamlit.logger import get_logger
from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent import json_encoding, tree, widget_values
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.runtime.state.common import is_element_id, user_key_from_element_id

if TYPE_CHECKING:
    from collections.abc import Iterable

    from google.protobuf.message import Message

    from streamlit.elements.lib.agent_spec import ActionKind
    from streamlit.runtime.agent.tree import Node
    from streamlit.runtime.state.session_state import SessionState

_LOGGER: Final = get_logger(__name__)

SCHEMA_VERSION: Final = 1

# Why an element the snapshot shows cannot be used now.
BlockedReason: TypeAlias = Literal["closed_dialog", "compile_error"]

# Why an element's `data` is incomplete and has no `url` serving the rest.
# ``too_large_to_serve``: above `server.maxMessageSize`. ``multiple_datasets``:
# a chart over several tables. ``external_url``: a chart whose browser fetches
# data this API does not hold. ``lazy_loading``: a lazily loaded dataframe,
# whose first chunk is the preview. ``undescribed``: an element replayed from a
# cache a browser filled, which registered nothing.
UnavailableReason: TypeAlias = Literal[
    "too_large_to_serve",
    "multiple_datasets",
    "external_url",
    "lazy_loading",
    "undescribed",
]

# What a Plotly template can add to a figure's content rather than its styling,
# such as a "DRAFT" annotation. Kept when the rest of the template is dropped.
_TEMPLATE_CONTENT: Final = ("annotations", "shapes", "images")

# Commands whose whole contribution is layout or styling: a placeholder nobody
# filled, blank space, style-only HTML, and a loading skeleton, which by the
# time a run settles stands for nothing still to come. See
# `_SnapshotBuilder._is_contentless`.
_CONTENTLESS_TYPES: Final = {"empty", "space", "html", "skeleton"}


class ElementState(NamedTuple):
    """What the last snapshot knew about an addressable element.

    The next request is validated against this rather than against live widget
    metadata, because metadata outlives the widget: a control that stopped
    rendering still has metadata, so metadata alone cannot answer whether the
    control is still on the page. Recording why an element is not actionable
    lets a rejection name the actual reason.
    """

    actionable: bool
    disabled: bool
    support: str | None
    # The owning st.form, for elements inside one. Form membership exists only
    # on the emitted element, not in the runtime's widget registry.
    form_id: str | None
    # The closed list a later request must belong to. ``None`` when the widget
    # accepts values outside its options, or when it has no fixed list. The
    # description still carries those options for the client.
    options: list[Any] | None
    # The fragment this element lives in, if any. A request that targets it is
    # scoped to that fragment, the way the browser scopes a widget change.
    fragment_id: str | None
    # Whether the element is inside an open `st.dialog`. Only a rerun scoped
    # to the dialog's fragment keeps it open, so a request that cannot be
    # scoped that way would discard what it sent to the dialog.
    in_dialog: bool
    # The command that emitted it, for checks that only apply to some, such as
    # reading ISO text for a date-time input.
    command: str = ""
    # The most items a request may send: `value_schema.maxItems` for a range,
    # or `props.max_selections` for a multiselect. A longer list is refused.
    max_items: int | None = None
    # The JSON type its `value_schema` names, so a number is not accepted as
    # text where the wire form happens to be a string, as for `st.feedback`.
    schema_type: str | None = None
    # Whether a browser user can empty it, so a later request's null clears it
    # rather than resetting it to a non-empty default.
    clearable: bool = False
    # What the element is acted on with, "value" or "trigger", or None for a
    # display-only element. It decides whether `widget_state` or `trigger`
    # addresses it, and tells a display-only element from one that cannot be
    # used right now, such as a widget in a closed dialog.
    action: ActionKind | None = None
    # Why an element the snapshot shows cannot be used now: "closed_dialog"
    # for one in a closed dialog, "compile_error" for one left from an
    # earlier run when the script failed to compile. Enabling it would not
    # help.
    blocked_by: BlockedReason | None = None


@dataclass
class Snapshot:
    """A serialized snapshot plus the bookkeeping the next request needs."""

    document: dict[str, Any]
    # Keyed by element ID, in tree order, which a batched write's widget
    # states are encoded in.
    element_states: dict[str, ElementState]
    # Whether the run failed to compile. The page it leaves usually has no
    # elements, so a write to one from the page before names this cause.
    compile_error: bool = False


class _SnapshotBuilder:
    """Serialize a merged tree into snapshot nodes.

    Collects the actions index and each keyed element's state along the way.
    """

    def __init__(self, session_state: SessionState | None) -> None:
        self._session_state = session_state
        self.actions: list[dict[str, Any]] = []
        self.element_states: dict[str, ElementState] = {}
        self.undescribed_types: set[str] = set()
        self.saw_uncaught_exception = False
        # Dialogs cannot nest, so a flag is enough to track the one being
        # serialized. A closed one stays in the tree, but the frontend
        # unmounts it, so nothing inside it can be used.
        self._in_dialog = False
        self._closed_dialog = False

    def serialize_children(
        self, node: Node, inherited_support: str | None = None
    ) -> list[dict[str, Any]]:
        result: list[dict[str, Any]] = []
        for _, child in sorted(node.children.items()):
            result.extend(self._serialize(child, inherited_support))
        return result

    def _serialize(
        self, node: Node, inherited_support: str | None
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
    def _is_contentless(node: Node) -> bool:
        """True for an element that would serialize to nothing but its name.

        `st.empty()` reserves a slot and `st.space()` adds blank space, so an
        unfilled one of either says only "there is nothing here", which is what
        its absence says too.

        Checked against the props rather than the name alone, so either command
        gaining something meaningful to say starts being reported again.
        """
        return node.description.get("type") in _CONTENTLESS_TYPES and not (
            node.description.get("props") or node.description.get("key")
        )

    def _serialize_container(
        self, node: Node, inherited_support: str | None = None
    ) -> list[dict[str, Any]]:
        # A container's support reason binds its contents, so actions never
        # lists a child the container itself denies.
        support = node.description.get("support") or inherited_support
        is_dialog = node.description.get("type") == "dialog"
        dialog_props = (node.description.get("props") or {}) if is_dialog else {}
        closed_dialog = dialog_props.get("is_open") is False
        if (
            node.root_name is None
            and node.block is not None
            and not node.description.get("transparent")
        ):
            # Recorded before its body, so `actions` and `element_states` both
            # follow tree order, which a batched write's callbacks run in, and
            # a dialog's own state stays outside the in-dialog window.
            self._record_element_state(
                node.description,
                inherited_support,
                None,
                node.fragment_id,
                unusable=closed_dialog,
            )
        # A dialog closed in this run still has its body in the tree. Only an
        # open one makes those widgets cross-dialog writes. A closed one is
        # unmounted, so nothing in it can be set or fired. The flag covers the
        # body; the dialog's own dismiss trigger is recorded above.
        if dialog_props.get("is_open") is True:
            self._in_dialog = True
        if closed_dialog:
            self._closed_dialog = True
        children = self.serialize_children(node, support)
        if closed_dialog:
            self._closed_dialog = False
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
            description.get("type") == "container"
            and not props
            and not description.get("key")
            and len(children) == 1
        ):
            # A layout wrapper with one child and nothing configured carries no
            # meaning of its own. An authored key is a name the author gave it.
            return children

        result = self._base(description, inherited_support)
        self._note_fragment(node, result)
        self._note_bind(description.get("key"), result)

        # A container can be a widget itself: `st.tabs(on_change="rerun")`
        # registers one whose value is the open tab. Without this it would be
        # keyed in the tree but missing from `actions`, and the views behind its
        # other tabs would be unreachable.
        action = description.get("action")
        if action and (element_id := description.get("key")):
            value = widget_values.reported_value(
                self._session_state,
                element_id,
                value_schema=description.get("value_schema"),
            )
            _attach_value(result, action, value, description.get("value_schema"))

        result["children"] = children
        return [result]

    def _note_fragment(self, node: Node, result: dict[str, Any]) -> None:
        """Report the fragment a node belongs to, if it belongs to one."""
        if node.fragment_id is None:
            return
        result["fragment"] = node.fragment_id

    def _note_bind(self, element_id: str | None, result: dict[str, Any]) -> None:
        """Report a widget's `bind` parameter, which the widget registry holds.

        Read here rather than passed by every widget's description, since every
        widget registers it. It tells a client that the widget mirrors the URL
        parameter named after its key, so `query_params` can set it.
        """
        if not element_id or self._session_state is None:
            return
        metadata = self._session_state.get_widget_metadata(element_id)
        if metadata is not None and metadata.bind:
            result.setdefault("props", {})["bind"] = metadata.bind

    def _serialize_element(
        self, node: Node, inherited_support: str | None = None
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
            # error display sets `uncaught`. An undescribed exception, such as
            # one replayed from a cache a browser filled, is that display
            # command too: a failed run is still reported by the run's own flag.
            props = description.get("props") or {}
            self.saw_uncaught_exception |= props.get("uncaught") is True

        result = self._base(description, inherited_support)
        self._note_fragment(node, result)
        element_id = description.get("key")
        self._note_bind(element_id, result)

        action = description.get("action")
        if element_id and action and not _is_write_only(description):
            props = description.get("props") or {}
            options = props.get("options")
            value = widget_values.reported_value(
                self._session_state,
                element_id,
                options=options if isinstance(options, list) else None,
                value_schema=description.get("value_schema"),
                accept_new_options=props.get("accept_new_options") is True,
            )
            _attach_value(result, action, value, description.get("value_schema"))

        data = _data_block(
            proto_field, payload, description, described=bool(node.description)
        )
        if data:
            result["data"] = data

        form_id = getattr(payload, "form_id", "") if payload is not None else ""
        if form_id and element_id:
            result["form_id"] = form_id

        self._record_element_state(
            description, inherited_support, form_id or None, node.fragment_id
        )
        return result

    def _record_element_state(
        self,
        description: dict[str, Any],
        inherited_support: str | None,
        form_id: str | None,
        fragment_id: str | None = None,
        *,
        unusable: bool = False,
    ) -> None:
        """Record what a node offers, and list it in `actions` if it is usable.

        Recorded for every keyed node, not just the usable ones, so the next
        request can be told what is actually wrong with a key rather than being
        told it is on the wrong page.
        """
        element_id = description.get("key")
        command = description.get("type")
        if not element_id or not isinstance(command, str):
            return

        props = description.get("props") or {}
        action = description.get("action")
        support = description.get("support") or inherited_support
        disabled = bool(props.get("disabled"))
        # Membership list for the next request. A widget that accepts new
        # text has no such list: any value of the right schema is legal, and
        # its options stay on the description. Otherwise a command publishes
        # `choices` when the list is not its `options` parameter.
        options: list[Any] | None
        if props.get("accept_new_options") is True:
            options = None
        else:
            published = description.get("choices")
            if isinstance(published, list):
                options = published
            else:
                candidate = props.get("options")
                options = candidate if isinstance(candidate, list) else None
        # A closed dialog is still in the tree, but the frontend unmounts it.
        in_closed_dialog = unusable or self._closed_dialog
        actionable = (
            bool(action) and not support and not disabled and not in_closed_dialog
        )

        self.element_states[element_id] = ElementState(
            actionable=actionable,
            disabled=disabled,
            support=support,
            form_id=form_id,
            # A copy, so a later check can filter this list without rewriting
            # the options already published on the element.
            options=list(options) if isinstance(options, list) else None,
            fragment_id=fragment_id,
            in_dialog=self._in_dialog,
            command=command,
            max_items=_max_items(description, props),
            schema_type=(description.get("value_schema") or {}).get("type"),
            # Whether a browser user can empty it, so null clears it rather
            # than resetting it to a non-empty default.
            clearable=description.get("clearable") is True,
            action=action if action in {"value", "trigger"} else None,
            blocked_by="closed_dialog" if in_closed_dialog else None,
        )
        if actionable:
            # The type and label name the entry, so a client can tell generated
            # `$$ID-...` keys apart; what to send stays on the element.
            entry: dict[str, Any] = {
                "key": _public_key(element_id),
                "kind": str(action),
                "type": command,
            }
            if isinstance(label := props.get("label"), str) and label:
                entry["label"] = label
            self.actions.append(entry)

    def _base(
        self, description: dict[str, Any], inherited_support: str | None = None
    ) -> dict[str, Any]:
        """Build the node fields common to elements and containers."""
        result: dict[str, Any] = {"type": description.get("type") or "unknown"}

        element_id = description.get("key")
        if element_id:
            result["key"] = _public_key(element_id)

        props = description.get("props") or {}
        if props:
            result["props"] = props
        # Repeated onto descendants of an unusable container, so a client never
        # has to walk up the tree to find out why a node is not in `actions`.
        if support := description.get("support") or inherited_support:
            result["support"] = support
        if value_schema := description.get("value_schema"):
            result["value_schema"] = value_schema
        # Whether `null` empties the widget. The current `value` cannot say so
        # once a selection has replaced an empty default.
        if description.get("clearable") is True:
            result["clearable"] = True
        return result


def _attach_value(
    result: dict[str, Any], action: Any, value: Any, value_schema: Any
) -> None:
    """Set ``value`` when the element holds one a request can send.

    A value widget always reports its value, including null. A trigger reports
    one only when it has a ``value_schema`` (a payload such as chat text) and
    only while that payload is set. An empty string is a fired payload. A
    button stores ``True`` and has no schema, so it reports none.
    """
    if action == "value" or (
        value_schema is not None and value is not None and value is not False
    ):
        result["value"] = value


def _max_items(description: dict[str, Any], props: dict[str, Any]) -> int | None:
    """The longest list a later request may send for this element.

    ``value_schema.maxItems`` covers a range. ``st.multiselect`` publishes its
    limit as ``props.max_selections`` instead, and a longer selection is refused.
    """
    limit = (description.get("value_schema") or {}).get("maxItems")
    if isinstance(limit, bool) or not isinstance(limit, int):
        limit = props.get("max_selections")
    if isinstance(limit, bool) or not isinstance(limit, int):
        return None
    return limit


def _public_key(element_id: str) -> str:
    """The key a client sends back: the author's key, or the opaque element ID.

    A widget's element ID embeds the author's key. Forms, containers, and
    display elements are recorded under the author's key itself, which may
    contain the hyphens an element ID is split on.
    """
    if is_element_id(element_id):
        return user_key_from_element_id(element_id) or element_id
    return element_id


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
        skipped |= {"value", "default", "raw_value", "raw_values"}

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

    A password is the only such widget. Responses are logged and kept in a
    model's context, so a password the app defaulted or the client typed must
    not come back out.
    """
    props = description.get("props") or {}
    return description.get("type") == "text_input" and props.get("type") == "password"


def _preview_row_limit() -> int:
    """Rows included in a `data.preview`, from `server.agentPreviewRows`.

    The default is large enough that most filtered tables are reported complete
    and need no second request, and small enough that a page of them does not
    dominate the response. A negative setting includes no rows.
    """
    return max(0, int(config.get_option("server.agentPreviewRows")))


def _data_block(
    proto_field: str,
    payload: Any,
    description: dict[str, Any],
    *,
    described: bool,
) -> dict[str, Any] | None:
    """The `data` an element carries, resolved so `complete` always has an answer.

    Either the preview is everything (`complete: true`), or `url` serves all of
    it, or `unavailable` says why nothing does. A `url` never comes with an
    `unavailable` reason. ``described`` is whether the command described itself;
    an element without a description registered no data to serve.
    """
    if "data_summary" in description:
        # A command whose payload does not carry its table supplies the summary
        # itself: `st.map` emits a generated Deck.gl spec.
        summary = description["data_summary"]
        data = dict(summary) if isinstance(summary, dict) else {}
    else:
        data = _element_data(proto_field, payload) or {}
    if not data:
        return None

    if data.get("complete") is not True:
        data["complete"] = False
    url = description.get("data_url")
    if isinstance(url, str) and url and "unavailable" not in data:
        # A fetch-now handle, registered while the script ran. Also reported
        # for a complete table, so every table has the same contract. The file
        # is collected once the element that produced it stops rendering.
        data["url"] = url
    elif data["complete"] is False:
        reason: UnavailableReason = "too_large_to_serve" if described else "undescribed"
        data.setdefault("unavailable", reason)
    return data


def _unavailable(reason: UnavailableReason) -> dict[str, Any]:
    return {"complete": False, "unavailable": reason}


def _element_data(proto_field: str, payload: Any) -> dict[str, Any] | None:
    """Describe the data an element's payload carries, as derived facts.

    ``payload`` is typed loosely because each branch narrows it to a different
    proto by way of ``proto_field``.
    """
    if payload is None:
        return None

    if proto_field == "dataframe":
        if payload.HasField("lazy_data"):
            return _lazy_dataframe_data(payload.lazy_data)
        return summarize_arrow(payload.arrow_data.data)

    if proto_field == "table":
        return summarize_arrow(payload.arrow_data.data)

    if proto_field == "vega_lite_chart":
        return _vega_data(payload)

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
        # A chart given a specification is reported complete, as a Plotly
        # figure is. Its rows are counted only when every layer has them inline.
        deck_data: dict[str, Any] = {"spec": spec, "complete": True}
        if (row_count := _deck_gl_row_count(spec)) is not None:
            deck_data["row_count"] = row_count
        return deck_data

    return None


def _lazy_dataframe_data(lazy_data: Any) -> dict[str, Any] | None:
    """A lazily loaded dataframe, previewed by the chunk its browser received.

    The rest is only fetched by a browser as it scrolls, so nothing serves it,
    and the chunk alone would pass for the whole table. The row count is the
    source's, reported only when the source knows it.
    """
    data = summarize_arrow(lazy_data.initial_chunk.data)
    if data is None:
        return None
    data.update(_unavailable("lazy_loading"))
    if lazy_data.HasField("row_count"):
        data["row_count"] = lazy_data.row_count
    else:
        del data["row_count"]
    return data


def _vega_data(payload: Any) -> dict[str, Any]:
    """A Vega-Lite chart's one table and its specification.

    Only a chart over a single Arrow buffer is summarized. Several buffers are
    not one table, and data the specification loads from a URL is fetched by
    the browser, which this API does not do; in either case none of it is
    served, rather than a part passed off as the whole.
    """
    buffers = agent_spec.vega_arrow_buffers(payload)
    spec = _parse_json(payload.spec)
    data: dict[str, Any]
    if len(buffers) > 1:
        data = _unavailable("multiple_datasets")
    elif agent_spec.vega_loads_from_url(spec):
        data = _unavailable("external_url")
    elif buffers:
        data = summarize_arrow(buffers[0]) or {}
    else:
        # Inline values travel as Arrow, so what is left in the specification,
        # such as GeoJSON, is all of it.
        data = {"complete": True}
    if isinstance(spec, dict):
        # The built-in charts write 0 for a size the author left unset, which
        # means "fill the container", not a size.
        spec = {
            name: value
            for name, value in spec.items()
            if not (name in {"width", "height"} and value == 0)
        }
    if spec is not None:
        data["spec"] = spec
    return data


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
    of data -- the same bytes the app already sends its own client.
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
    """Count the rows a Deck.gl specification plots, across its layers.

    Only when every layer carries its rows inline. A layer whose data is a URL
    or an object such as GeoJSON has no count to read, and a partial sum would
    pass for the whole.
    """
    if not isinstance(spec, dict):
        return None
    layers = spec.get("layers")
    if not isinstance(layers, list):
        return None

    total = 0
    for layer in layers:
        rows = layer.get("data") if isinstance(layer, dict) else None
        if not isinstance(rows, list):
            return None
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
    """Describe an Arrow IPC stream: its schema, its size, and a row preview.

    The preview holds the first ``server.agentPreviewRows`` rows, as values in
    column order. ``complete`` is whether those rows are the whole table.

    Parameters
    ----------
    arrow_bytes : bytes
        The serialized Arrow IPC stream, as an element's payload carries it.

    Returns
    -------
    dict[str, Any] or None
        The element's ``data`` without a ``url``, or ``None`` for empty or
        unreadable bytes.
    """
    if not arrow_bytes:
        return None

    import pyarrow as pa

    limit = _preview_row_limit()
    try:
        table = pa.RecordBatchStreamReader(arrow_bytes).read_all()
        rows = _arrow_rows(table, limit)
    except Exception:
        # Any failure, not just a malformed stream: an element without a
        # summary costs far less than a failed snapshot, or a failed command
        # for `st.map`, which summarizes its table while the script runs.
        _LOGGER.debug("Could not summarize an Arrow payload.", exc_info=True)
        return None

    columns = _arrow_columns(table)
    return {
        "columns": columns,
        "row_count": table.num_rows,
        "column_count": len(columns),
        # `complete` sits at the top of `data` because it is the first question
        # a client asks, and it is the only flag: a second one inside `preview`
        # would only ever be its inverse.
        "complete": table.num_rows <= limit,
        "preview": {
            # Rows are values in `columns` order rather than objects, because
            # repeating the column names on every row is most of a preview's
            # size once it gets long.
            "rows": rows,
        },
    }


def _arrow_columns(table: Any) -> list[dict[str, str]]:
    """An Arrow table's columns with their types, by position.

    Every column the bytes behind `data.url` carry, under the same names, so
    the reported schema is the schema of what a client fetches. That includes
    an unnamed, non-range index, which pandas stores as `__index_level_N__` and
    `st.dataframe` displays.
    """
    return [
        {"name": name, "type": str(dtype)}
        for name, dtype in zip(table.schema.names, table.schema.types, strict=True)
    ]


def _arrow_rows(table: Any, limit: int) -> list[list[Any]]:
    """Up to ``limit`` rows, as JSON values in column order.

    By position rather than by name, so a table with two columns of the same
    name keeps both.
    """
    if table.num_columns == 0:
        # Zipping no columns yields no rows, but the table still has them.
        return [[] for _ in range(min(table.num_rows, limit))]
    return [
        [json_encoding.to_json_value(cell) for cell in row]
        for row in zip(
            *(column.to_pylist() for column in table.slice(0, limit).columns),
            strict=True,
        )
    ]


def build_snapshot(
    *,
    session_id: str,
    messages: list[ForwardMsg],
    session_state: SessionState | None,
    query_params: dict[str, list[str]],
) -> Snapshot:
    """Build the snapshot document for the run that just settled.

    Session state is read without the lock ``SafeSessionState`` takes, so call
    this on the script thread or while no run can start. Trigger payloads are cleared
    in ``on_script_finished``, and this read has to happen before that reset
    to keep a fired ``st.chat_input`` or ``st.menu_button`` value. ``page`` and
    ``pages`` come from the run's ``new_session`` message; a later
    ``navigation`` message replaces that page list. Pass those messages or the
    fields stay empty.
    """
    root = tree.merge_deltas(messages)
    builder = _SnapshotBuilder(session_state)
    children = builder.serialize_children(root)

    new_session = _last_message(messages, "new_session")
    finished = _last_message(messages, "script_finished")
    compile_error = (
        finished is not None
        and finished.script_finished == ForwardMsg.FINISHED_WITH_COMPILE_ERROR
    )
    if compile_error:
        _add_compile_error(children, messages)
        # The page did not run. Widgets from an earlier run stay in the tree
        # the caller passed, and none of them can be used.
        builder.actions.clear()
        builder.element_states = {
            element_id: state._replace(actionable=False, blocked_by="compile_error")
            for element_id, state in builder.element_states.items()
        }

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
        "observed_at": dt.datetime.now(dt.UTC)
        .isoformat(timespec="seconds")
        .replace("+00:00", "Z"),
        "page": current_page,
        "pages": pages,
        # A copy, so a caller can edit the dict or its lists without changing
        # a snapshot retained for the next request.
        "query_params": {key: list(values) for key, values in query_params.items()},
        "tree": {"type": "root", "children": children},
        "actions": builder.actions,
    }

    if builder.undescribed_types:
        # Commands that have not been given an agent-API description yet.
        # Reported so a gap is visible to the caller instead of looking like a
        # real command name.
        document["undescribed_types"] = sorted(builder.undescribed_types)

    return Snapshot(
        document=document,
        element_states=builder.element_states,
        compile_error=compile_error,
    )


def rebase_media_urls(
    document: dict[str, Any], *, paths: Iterable[str], prefix: str
) -> None:
    """Prefix a snapshot's media URLs with the way back to the app's root, in place.

    Media storage hands out URLs relative to the app's root (``/media/<id>``),
    and so does an app that serves its own static files (``/app/static/<file>``).
    A browser resolves both against its own base path. A client of this API
    has no base path to resolve against, so the URL has to say how to reach the
    root: as is, behind ``server.baseUrlPath`` or a hosting prefix, a media URL
    is a 404 or a login redirect.

    Only ``data.url`` and the ``url``, ``src``, and ``avatar`` props are
    touched, and only values under one of ``paths``, so an external link an app
    displays is never rewritten.

    Parameters
    ----------
    document : dict[str, Any]
        A snapshot document from ``build_snapshot``.
    paths : Iterable[str]
        The paths below the app's root that media URLs start with, such as
        ``"/media"`` and ``"/app/static"``.
    prefix : str
        The relative path from the request's URL to the app's root, such as
        ``"../.."``. It is prepended to each media URL.
    """
    path_prefixes = tuple(path.rstrip("/") + "/" for path in paths)

    def rebase(value: Any) -> Any:
        if isinstance(value, str) and value.startswith(path_prefixes):
            return prefix + value
        # Several images report a list of URLs.
        if isinstance(value, list):
            return [rebase(item) for item in value]
        return value

    def walk(node: dict[str, Any]) -> None:
        data = node.get("data")
        if isinstance(data, dict) and "url" in data:
            data["url"] = rebase(data["url"])
        props = node.get("props")
        if isinstance(props, dict):
            for name in ("url", "src", "avatar"):
                if name in props:
                    props[name] = rebase(props[name])
        for child in node.get("children") or []:
            walk(child)

    root = document.get("tree")
    if isinstance(root, dict):
        walk(root)


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

    That session event is marshalled without ``client.showErrorDetails``. The
    snapshot copies it. A compile failure is the developer looking at their
    own script, and the page is already showing the full exception.
    """
    exception = _compilation_exception(messages)
    if exception is None:
        return
    main = next((child for child in children if child.get("type") == "main"), None)
    if main is None:  # pragma: no cover - merge_deltas always emits main
        return
    props: dict[str, Any] = {"uncaught": True}
    if exception.type:
        props["type"] = exception.type
    if exception.message:
        props["message"] = exception.message
    if exception.stack_trace:
        props["stack_trace"] = list(exception.stack_trace)
    main.setdefault("children", []).append({"type": "exception", "props": props})


def _compilation_exception(messages: list[ForwardMsg]) -> Any:
    """The latest compile-error exception in ``messages``, if one was sent.

    ``script_finished`` can precede the session event, and a later event such
    as ``script_changed_on_disk`` must not hide the compile error.
    """
    for msg in reversed(messages):
        if msg.WhichOneof("type") != "session_event":
            continue
        if msg.session_event.HasField("script_compilation_exception"):
            return msg.session_event.script_compilation_exception
    return None


def _last_message(messages: list[ForwardMsg], msg_type: str) -> ForwardMsg | None:
    for msg in reversed(messages):
        if msg.WhichOneof("type") == msg_type:
            return msg
    return None


def _pages(
    messages: list[ForwardMsg], new_session: ForwardMsg | None
) -> tuple[list[dict[str, Any]], dict[str, Any]]:
    """List the app's pages and identify the current one by ``url_path``.

    ``st.navigation`` supersedes the page list in ``new_session``, so a later
    navigation message wins. External links are left out: they open another
    site, and ``st.navigation`` will not switch the app to them.
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
        # An external link is a nav item, not a page the app can show.
        if page.HasField("external_url"):
            continue
        entry: dict[str, Any] = {
            "url_path": "" if single_page else page.url_pathname,
            "title": default_title if single_page else page.page_name or default_title,
        }
        if page.icon:
            entry["icon"] = page.icon
        pages.append(entry)
        if page.page_script_hash == current_hash:
            # A copy, so a caller can change `page` without changing `pages`.
            current_page = dict(entry)

    return pages, current_page
