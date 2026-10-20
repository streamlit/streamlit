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

``data``, the derived facts about a dataframe or chart, is not attached yet.
A command's parameters stay in ``props``.
"""

from __future__ import annotations

import datetime as dt
from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Final, NamedTuple

from streamlit.proto.ForwardMsg_pb2 import ForwardMsg
from streamlit.runtime.agent import json_encoding, tree, widget_values
from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.runtime.state.common import is_element_id, user_key_from_element_id

if TYPE_CHECKING:
    from google.protobuf.message import Message

    from streamlit.runtime.agent.tree import _Node
    from streamlit.runtime.state.session_state import SessionState

SCHEMA_VERSION: Final = 1

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
    # The most items its `value_schema` allows, such as 2 for a range. A longer
    # list would reach the app, where `start, end = st.date_input(...)` raises.
    max_items: int | None = None
    # The JSON type its `value_schema` names, so a number is not accepted as
    # text where the wire form happens to be a string, as for `st.feedback`.
    schema_type: str | None = None
    # Whether a browser user can empty it although it has a default, which
    # decides whether `null` clears it or resets it.
    clearable: bool = False


@dataclass
class Snapshot:
    """A serialized snapshot plus the bookkeeping the next request needs."""

    document: dict[str, Any]
    element_states: dict[str, ElementState]


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
        its absence says too.

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
        dialog_props = (node.description.get("props") or {}) if is_dialog else {}
        actions_before_children = len(self.actions)
        # A dialog closed in this run still has its body in the tree. Only an
        # open one makes those widgets cross-dialog writes. A closed one is
        # unmounted, so nothing in it can be set or fired. The flag covers the
        # body; the dialog's own dismiss trigger is passed below.
        if dialog_props.get("is_open") is True:
            self._in_dialog = True
        closed_dialog = dialog_props.get("is_open") is False
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
            # As for elements, a trigger's value only means anything while set.
            # An empty string is a fired payload. False is an unclicked button.
            if action == "value" or (value is not None and value is not False):
                result["value"] = value
        # The container is recorded after its body so a dialog's own state
        # stays outside the in-dialog window. Its action is then moved in
        # front of the children's, so `actions` follows tree order.
        before_record = len(self.actions)
        self._record_element_state(
            description,
            inherited_support,
            None,
            node.fragment_id,
            unusable=closed_dialog,
        )
        if len(self.actions) == before_record + 1:
            self.actions.insert(actions_before_children, self.actions.pop())

        result["children"] = children
        return [result]

    def _note_fragment(self, node: _Node, result: dict[str, Any]) -> None:
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
            # An empty string is a fired payload. False is an unclicked button.
            if action == "value" or (value is not None and value is not False):
                # A trigger's value only means anything while it is set, and it
                # resets right after the run that observed it.
                result["value"] = value

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
        actionable = (
            bool(action)
            and not support
            and not disabled
            and not unusable
            and not self._closed_dialog
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
            max_items=(description.get("value_schema") or {}).get("maxItems"),
            schema_type=(description.get("value_schema") or {}).get("type"),
            # The command says whether choosing the current value again
            # empties it. The snapshot does not infer that from the command.
            clearable=description.get("clearable") is True,
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
        return result


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


def build_snapshot(
    *,
    session_id: str,
    messages: list[ForwardMsg],
    session_state: SessionState | None,
    query_params: dict[str, list[str]],
) -> Snapshot:
    """Build the snapshot document for the run that just settled.

    Session state is read without the lock ``SafeSessionState`` takes, so call
    this on the script thread or hold that lock. Trigger payloads are cleared
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
            element_id: state._replace(actionable=False)
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
