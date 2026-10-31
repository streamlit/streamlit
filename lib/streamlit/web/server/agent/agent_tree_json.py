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

"""Serialize an AppTest element tree into the agent JSON snapshot shape."""

from __future__ import annotations

import json
import math
from collections.abc import Sequence
from datetime import date, datetime, time
from decimal import Decimal
from typing import Any, Final

from streamlit.runtime.state import SCRIPT_RUN_WITHOUT_ERRORS_KEY
from streamlit.testing.v1.element_tree import (
    Block,
    Element,
    ElementTree,
    Widget,
)

_TRIGGER_TYPES: Final[frozenset[str]] = frozenset(
    {
        "button",
        "download_button",
        "chat_input",
        "menu_button",
    }
)

_BROWSER_REQUIRED_TYPES: Final[frozenset[str]] = frozenset(
    {
        "file_uploader",
        "camera_input",
        "audio_input",
        "iframe",
        "html",
        "component_instance",
        "bidi_component",
    }
)

_NON_INTERACTIVE_TYPES: Final[frozenset[str]] = frozenset(
    {
        "data_editor",
        "dialog",
        *_BROWSER_REQUIRED_TYPES,
    }
)

_PROP_NAMES: Final[tuple[str, ...]] = (
    "label",
    "help",
    "body",
    "placeholder",
    "format",
    "icon",
    "disabled",
    "expanded",
    "caption",
    "delta",
    "options",
    "min",
    "max",
    "step",
    "min_value",
    "max_value",
    "horizontal",
    "required",
    "max_selections",
    "accept_file",
)

_BLOCK_TYPE_ALIASES: Final[dict[str, str]] = {
    "expandable": "expander",
    "tab_container": "tabs",
    "column_container": "columns",
}

# Proto field names that differ from the public parameter name, per element type.
# The snapshot must spell every prop the way a user writes it, so a proto-only
# name would spend the advantage of matching the public API.
_PROP_RENAMES: Final[dict[str, dict[str, str]]] = {
    "metric": {"body": "value"},
}

_CHART_TYPES: Final[frozenset[str]] = frozenset(
    {
        "vega_lite_chart",
        "plotly_chart",
        "graphviz_chart",
        "deck_gl_json_chart",
        "echarts_chart",
    }
)

_TABULAR_TYPES: Final[frozenset[str]] = frozenset({"dataframe", "table"})

_ROOT_CONTAINERS: Final[tuple[str, ...]] = ("main", "sidebar", "event", "bottom")


def element_tree_to_agent_json(
    tree: ElementTree,
    *,
    session_id: str,
    pages: list[dict[str, Any]],
    page: dict[str, Any],
    query_params: dict[str, list[str]],
    run_ok: bool,
    observed_at: str,
    session_state: Any | None = None,
) -> dict[str, Any]:
    """Build a schema_version 1 agent snapshot from an element tree."""
    children = [
        _serialize_root_container(tree, name, session_state)
        for name in _ROOT_CONTAINERS
    ]
    snapshot: dict[str, Any] = {
        "schema_version": 1,
        "session_id": session_id,
        "status": "ready" if run_ok else "error",
        "observed_at": observed_at,
        "page": page,
        "pages": pages,
        "query_params": query_params,
        "tree": {"type": "root", "children": children},
    }
    snapshot["actions"] = _collect_actions(tree)
    return snapshot


def run_reported_ok(session_state: Any, tree: ElementTree) -> bool:
    """Treat the run as failed when session state or an exception element says so."""
    flag_ok = True
    try:
        if SCRIPT_RUN_WITHOUT_ERRORS_KEY in session_state:
            flag_ok = bool(session_state[SCRIPT_RUN_WITHOUT_ERRORS_KEY])
    except (KeyError, TypeError):
        flag_ok = True
    has_exception = any(getattr(node, "type", None) == "exception" for node in tree)
    return flag_ok and not has_exception


def _serialize_root_container(
    tree: ElementTree, name: str, session_state: Any | None
) -> dict[str, Any]:
    block = _root_block(tree, name)
    if block is None:
        return {"type": name, "children": []}
    return _serialize_block(block, session_state)


def _root_block(tree: ElementTree, name: str) -> Block | None:
    for child in tree.children.values():
        if getattr(child, "type", None) == name and isinstance(child, Block):
            return child
    return None


def _serialize_block(block: Block, session_state: Any | None) -> dict[str, Any]:
    node_type = _BLOCK_TYPE_ALIASES.get(block.type, block.type)
    payload: dict[str, Any] = {"type": node_type}
    key = getattr(block, "key", None)
    if key:
        payload["key"] = key
    props = _public_props(block)
    if props:
        payload["props"] = props
    children = [
        _serialize_node(block.children[idx], session_state)
        for idx in sorted(block.children)
    ]
    payload["children"] = children
    return payload


def _serialize_node(node: Any, session_state: Any | None) -> dict[str, Any]:
    if isinstance(node, Block):
        return _serialize_block(node, session_state)
    payload: dict[str, Any] = {"type": node.type}
    key = _addressable_key(node)
    if key:
        payload["key"] = key
    props = _public_props(node)
    if props:
        payload["props"] = props
    derived = _derived_data(node)
    if derived:
        payload["data"] = derived
    value = _node_value(node, session_state)
    if (
        isinstance(node, Widget)
        and node.type not in _TRIGGER_TYPES
        and value is not None
    ):
        payload["value"] = value
    support = _support_reason(node)
    if support:
        payload["support"] = support
    return payload


def _addressable_key(node: Any) -> str | None:
    user_key = getattr(node, "key", None)
    if user_key:
        return str(user_key)
    widget_id = getattr(node, "id", None)
    if widget_id:
        return str(widget_id)
    return None


def _public_props(node: Any) -> dict[str, Any]:
    props: dict[str, Any] = {}
    proto = getattr(node, "proto", None)
    node_type = getattr(node, "type", None)
    renames = _PROP_RENAMES.get(node_type or "", {})
    for name in _PROP_NAMES:
        raw = _proto_attr(proto, name)
        encoded = _jsonable(raw)
        if encoded is None:
            continue
        if encoded in ("", [], {}):
            continue
        public_name = renames.get(name, name)
        if name in {"disabled", "expanded", "required"} and encoded is False:
            props[public_name] = False
            continue
        props[public_name] = encoded
    if getattr(node, "type", None) == "button" and proto is not None:
        button_type = getattr(proto, "type", None)
        if isinstance(button_type, str) and button_type:
            props.setdefault("type", button_type)
        elif button_type == 0:
            props.setdefault("type", "secondary")
        elif button_type == 1:
            props.setdefault("type", "primary")
        elif button_type == 2:
            props.setdefault("type", "tertiary")
    if getattr(node, "type", None) == "metric":
        metric_value = _jsonable(getattr(node, "value", None))
        if metric_value is not None:
            props.setdefault("value", metric_value)
    return props


def _proto_attr(proto: Any, name: str) -> Any:
    """Read a construction parameter off an element's proto.

    Props come from the proto rather than the tree node because container nodes
    expose same-named properties that return child-element collections (a
    ``Block`` has a ``caption`` accessor listing its ``st.caption`` children),
    which would otherwise be serialized in place of a real parameter.
    """
    if proto is None or not hasattr(proto, name):
        return None
    try:
        return getattr(proto, name)
    except (AttributeError, TypeError, ValueError):
        return None


def _derived_data(node: Any) -> dict[str, Any] | None:
    """Facts that are not construction parameters: table rows, chart specs.

    Agents need these to reason about what the user saw. They live in a sibling
    ``data`` object so ``props`` stays a map of public command parameters.
    """
    node_type = getattr(node, "type", None)
    proto = getattr(node, "proto", None)
    if node_type in _TABULAR_TYPES:
        return _tabular_data(node, proto)
    if node_type in _CHART_TYPES:
        return _chart_data(proto)
    if node_type == "exception" and proto is not None:
        message = getattr(proto, "message", None)
        if message:
            return {"message": str(message)}
    return None


def _tabular_data(node: Any, proto: Any) -> dict[str, Any] | None:
    try:
        frame = getattr(node, "value", None)
    except (AttributeError, TypeError, ValueError, KeyError):
        frame = None
    if frame is None:
        arrow = _arrow_bytes(proto)
        if arrow:
            frame = _arrow_to_pandas(arrow)
    return _pandas_records(frame)


def _chart_data(proto: Any) -> dict[str, Any] | None:
    if proto is None:
        return None
    payload: dict[str, Any] = {}
    spec_raw = getattr(proto, "spec", None)
    if isinstance(spec_raw, str) and spec_raw:
        try:
            payload["spec"] = json.loads(spec_raw)
        except json.JSONDecodeError:
            payload["spec"] = spec_raw
    config_raw = getattr(proto, "config", None)
    if isinstance(config_raw, str) and config_raw:
        try:
            payload["config"] = json.loads(config_raw)
        except json.JSONDecodeError:
            payload["config"] = config_raw
    values = _arrow_to_pandas(_arrow_bytes(getattr(proto, "data", None)))
    records = _pandas_records(values)
    if records:
        payload["values"] = records["rows"]
        payload["columns"] = records["columns"]
    datasets: dict[str, Any] = {}
    for dataset in getattr(proto, "datasets", None) or []:
        name = str(getattr(dataset, "name", "") or "")
        table = _pandas_records(
            _arrow_to_pandas(_arrow_bytes(getattr(dataset, "data", None)))
        )
        if name and table:
            datasets[name] = table["rows"]
    if datasets:
        payload["datasets"] = datasets
    spec = payload.get("spec")
    if "values" not in payload and isinstance(spec, dict):
        data_ref = spec.get("data")
        name = data_ref.get("name") if isinstance(data_ref, dict) else None
        if name and name in datasets:
            payload["values"] = datasets[name]
            payload["columns"] = (
                list(datasets[name][0].keys()) if datasets[name] else []
            )
        inline = data_ref.get("values") if isinstance(data_ref, dict) else None
        if inline and "values" not in payload:
            payload["values"] = _jsonable(inline)
    return payload or None


def _arrow_bytes(container: Any) -> bytes:
    if container is None:
        return b""
    if isinstance(container, (bytes, bytearray)):
        return bytes(container)
    data = getattr(container, "data", None)
    if isinstance(data, (bytes, bytearray)):
        return bytes(data)
    nested = getattr(data, "data", None)
    if isinstance(nested, (bytes, bytearray)):
        return bytes(nested)
    return b""


def _arrow_to_pandas(raw: bytes) -> Any:
    if not raw:
        return None
    from streamlit.dataframe_util import convert_arrow_bytes_to_pandas_df

    try:
        return convert_arrow_bytes_to_pandas_df(raw)
    except Exception:
        return None


def _pandas_records(frame: Any) -> dict[str, Any] | None:
    if frame is None:
        return None
    try:
        columns = [str(col) for col in frame.columns]
        rows = [
            {str(key): _jsonable(val) for key, val in record.items()}
            for record in frame.to_dict(orient="records")
        ]
    except (AttributeError, TypeError, ValueError):
        return None
    return {"columns": columns, "rows": rows, "row_count": len(rows)}


def _node_value(node: Any, session_state: Any | None) -> Any:
    if getattr(node, "type", None) in _TABULAR_TYPES | _CHART_TYPES:
        # Tabular and chart payloads live in ``data``; serializing the pandas
        # object here would dump a Python repr into ``value``.
        return None
    if session_state is not None:
        for lookup in (getattr(node, "key", None), getattr(node, "id", None)):
            if not lookup:
                continue
            try:
                if lookup in session_state:
                    return _jsonable(session_state[lookup])
            except (KeyError, TypeError, ValueError):
                continue
    if isinstance(node, Widget) and getattr(node, "_value", None) is not None:
        return _jsonable(node._value)
    if isinstance(node, Element) and node.type in {
        "markdown",
        "caption",
        "title",
        "header",
        "subheader",
        "text",
        "code",
        "latex",
    }:
        return None
    try:
        return _jsonable(getattr(node, "value", None))
    except (AttributeError, TypeError, ValueError, KeyError):
        return None


def _support_reason(node: Any) -> str | None:
    node_type = getattr(node, "type", None)
    if node_type in _BROWSER_REQUIRED_TYPES:
        return "browser_required"
    if node_type == "dialog":
        return "non_interactive"
    if node_type in {"file_uploader", "camera_input", "audio_input", "data_editor"}:
        return "non_interactive"
    return None


def _collect_actions(tree: ElementTree) -> list[dict[str, str]]:
    actions: list[dict[str, str]] = []
    for node in tree:
        if not isinstance(node, Widget):
            continue
        if getattr(node.proto, "disabled", False):
            continue
        if node.type in _NON_INTERACTIVE_TYPES:
            continue
        key = _addressable_key(node)
        if not key:
            continue
        kind = "trigger" if node.type in _TRIGGER_TYPES else "value"
        actions.append({"key": key, "kind": kind})
    return actions


def _jsonable(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return int(value)
    if isinstance(value, float):
        if math.isnan(value) or math.isinf(value):
            return None
        return value
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, str):
        return value
    if isinstance(value, bytes):
        return None
    # numpy / pandas scalars
    item = getattr(value, "item", None)
    if callable(item) and not isinstance(value, (dict, list, tuple)):
        try:
            converted = item()
        except (ValueError, AttributeError, TypeError):
            converted = None
        else:
            if converted is not value:
                return _jsonable(converted)
    if isinstance(value, dict):
        encoded = {str(k): _jsonable(v) for k, v in value.items()}
        return {k: v for k, v in encoded.items() if v is not None}
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return [_jsonable(item) for item in value]
    try:
        return str(value)
    except (TypeError, ValueError):
        return None
