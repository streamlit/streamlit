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

"""How a command describes itself to the agent API.

Every ``st.*`` command builds its semantic description the same way it builds
its proto, in the same function, from the same arguments::

    selectbox_proto = SelectboxProto()
    selectbox_proto.label = label
    selectbox_proto.options[:] = formatted_options
    ...

    self.dg._enqueue(
        "selectbox",
        selectbox_proto,
        agent_props=agent_spec.element(
            "selectbox",
            key=element_id,
            action="value",
            value_schema=agent_spec.STRING,
            label=label,
            options=formatted_options,
            help=selectbox_proto.help or None,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            accept_new_options=accept_new_options,
        ),
    )

The element ``type`` is the command name and every keyword is one of the
command's own parameter names, so the description is written and reviewed by
whoever owns the command. A widget also states the JSON shape of its value,
``value_schema``, which only the command knows for certain: whether it holds a
range, a whole number, or a date. Because it is built from the arguments rather than
from the proto, it carries what the proto cannot: the command's identity where
several commands share a payload, and parameters that never reach the wire.

A description is only built for sessions the agent API created -- for any other
session ``element`` returns ``None`` and the caller passes that straight through.
Its arguments are still evaluated in every session, so they must never raise for
an input the command accepts, and expensive preparation belongs behind
``is_recording()``.

``clearable`` and ``choices`` are the same kind of fact as ``value_schema``.
``clearable`` says a later value can be emptied, by choosing it again or by
clearing back to an empty default.
``choices`` is the list a request may send when that list is not the ``options``
parameter. Only the command knows either one, so the snapshot copies them.

Two things deliberately stay out of a command's description, because the command
cannot know them yet:

- ``value``, the widget's current value, which is only settled after the next
  run's callbacks and widget reconciliation.
- ``data``, the derived facts about a table or chart (schema, row counts, a
  bounded preview), which the serializer reads from the payload.

Both are filled in at snapshot time. That split is the same one the agent
protocol draws between ``props`` (how the element was built), ``value`` (what it
holds now), and ``data`` (what Streamlit derived). ``data`` is derived at
snapshot time from the payload; a command records only ``data_url``, where its
complete data is served.
"""

from __future__ import annotations

import json
from typing import TYPE_CHECKING, Any, Final, Literal, NamedTuple

if TYPE_CHECKING:
    from streamlit.proto.VegaLiteChart_pb2 import VegaLiteChart as VegaLiteChartProto

# What a client may do with an element on the next interaction. ``value`` means
# it holds a value that can be set; ``trigger`` means it can be fired once and
# resets afterwards. Omit it for a display element.
ActionKind = Literal["value", "trigger"]

# Why an element is not fully usable through the agent API. Omit it when the
# element is fully supported. ``browser_required``: what renders may differ from
# what is reported. ``action_unsupported``: a browser user can act on the
# element, and this API only reports that action. The limit is this API's, not
# the element's. A display-only element has nothing to withhold, so it stays
# unset.
SupportReason = Literal[
    "browser_required",
    "action_unsupported",
]

# Keys the snapshot serializer owns. A command's props are nested under "props"
# so a parameter can never collide with one of them.
_TYPE_KEY: Final = "type"
_KEY_KEY: Final = "key"
_ACTION_KEY: Final = "action"
_SUPPORT_KEY: Final = "support"
_PROPS_KEY: Final = "props"
_TRANSPARENT_KEY: Final = "transparent"
_VALUE_SCHEMA_KEY: Final = "value_schema"
_CLEARABLE_KEY: Final = "clearable"
_CHOICES_KEY: Final = "choices"
_DATA_URL_KEY: Final = "data_url"

# Building blocks for ``value_schema``: the JSON Schema of the value a request
# sends an element, in the form the snapshot reports it. They describe shape
# only; legal values -- options, bounds, ``max_chars`` -- are the element's
# props. A widget that lists options takes their ``format_func`` labels, so it
# is described as ``STRING`` whatever the options are.
STRING: Final[dict[str, Any]] = {"type": "string"}
INTEGER: Final[dict[str, Any]] = {"type": "integer"}
NUMBER: Final[dict[str, Any]] = {"type": "number"}
BOOLEAN: Final[dict[str, Any]] = {"type": "boolean"}
DATE: Final[dict[str, Any]] = {"type": "string", "format": "date"}


def list_of(items: dict[str, Any]) -> dict[str, Any]:
    """JSON Schema for any number of values, such as a multiselect."""
    return {"type": "array", "items": items}


def range_of(items: dict[str, Any], *, partial: bool = False) -> dict[str, Any]:
    """Two values, lowest first: a slider's or a date input's range.

    ``partial`` is for a date input's range, which may also be empty or hold
    only its start.
    """
    schema: dict[str, Any] = {"type": "array", "items": items}
    if not partial:
        schema["minItems"] = 2
    schema["maxItems"] = 2
    return schema


# Sessions created by the agent API. The registry that creates them owns this
# set, so "is this an agent session" is answerable on the script thread, where
# only the session id is at hand. Written on the event loop and read on script
# threads, so it is replaced rather than mutated: a reader always sees a whole
# set, with no lock on the per-element path.
_agent_session_ids: frozenset[str] = frozenset()


def register_agent_session(session_id: str) -> None:
    """Mark a session as driven by the agent API."""
    global _agent_session_ids  # noqa: PLW0603
    _agent_session_ids |= {session_id}


def forget_agent_session(session_id: str) -> None:
    """Forget a closed agent session."""
    global _agent_session_ids  # noqa: PLW0603
    _agent_session_ids -= {session_id}


def is_recording() -> bool:
    """True when the command being run should describe itself for the agent API.

    Gated per session, not just per server: only a session the agent API
    created records. A browser session sharing an agent-enabled server builds
    nothing, so its messages never carry a description and there is nothing to
    strip on the way out.

    The set is checked first: it is empty unless the agent API has registered
    a session, so the normal case costs one truth test per element and never
    looks up the script-run context.
    """
    session_ids = _agent_session_ids
    if not session_ids:
        return False

    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()
    return ctx is not None and ctx.session_id in session_ids


def _json_description(
    command: str,
    props: dict[str, Any],
    *,
    key: str | None,
    action: ActionKind | None,
    support: SupportReason | None,
    value_schema: dict[str, Any] | None = None,
    transparent: bool = False,
    clearable: bool = False,
    choices: list[Any] | None = None,
    data_url: str | None = None,
) -> str | None:
    """Encode a command description, or return ``None`` when this session is not recording."""
    if not is_recording():
        return None

    description: dict[str, Any] = {_TYPE_KEY: command}
    if key is not None:
        description[_KEY_KEY] = key
    if action is not None:
        description[_ACTION_KEY] = action
    if support is not None:
        description[_SUPPORT_KEY] = support
    if transparent:
        description[_TRANSPARENT_KEY] = True
    if value_schema is not None:
        description[_VALUE_SCHEMA_KEY] = value_schema
    if clearable:
        description[_CLEARABLE_KEY] = True
    if choices is not None:
        description[_CHOICES_KEY] = choices
    if data_url is not None:
        description[_DATA_URL_KEY] = data_url
    description[_PROPS_KEY] = _describe_props(props)
    return json.dumps(description)


def element(
    command: str,
    /,
    *,
    key: str | None = None,
    action: ActionKind | None = None,
    value_schema: dict[str, Any] | None = None,
    support: SupportReason | None = None,
    clearable: bool = False,
    choices: list[Any] | None = None,
    data_url: str | None = None,
    **props: Any,
) -> str | None:
    """Describe an element for the agent API, or return ``None`` when this session is not recording.

    ``command`` is positional-only so a command that has its own ``type``
    parameter (``st.button``, ``st.text_input``) can pass it straight through.

    Parameters
    ----------
    command
        The public command name, for example ``"selectbox"``. Never a proto
        field name.
    key
        The element's ID, or the author's ``key=`` for an element that has no
        ID. The snapshot reports the author's key when there is one and falls
        back to the ID otherwise.
    action
        Whether the element holds a value that can be set or is a trigger that
        can be fired. Omit for display elements.
    value_schema
        The JSON Schema of the value a request sends: required with
        ``action="value"``, and for a trigger that carries a payload. Built from
        the constants above.
    support
        Why the element is not fully usable, when it is not.
    clearable
        Whether a later value can be emptied, so a request may send ``null``
        to clear it: choosing the current value again, or clearing back to an
        empty default. Omit when neither applies. The snapshot copies this
        and does not infer it.
    choices
        The values a request may send, when they are not the ``options``
        parameter. Omit to use ``options`` when that parameter is a list.
    data_url
        Where the element's complete data can be fetched, from
        ``data_offload.serve_arrow_over_http``. Reported as ``data.url``
        rather than under ``props``, because it is not an argument the author
        passed.
    props
        The command's parameters, under their public names. ``None`` values are
        dropped, so an unsupplied optional parameter is absent rather than null.
        Pass the author's value or a processed form of it, such as dedented or
        stringified text, whichever reads as that parameter beside the
        command's docstring. A documented default may be omitted.
    """
    return _json_description(
        command,
        props,
        key=key,
        action=action,
        support=support,
        value_schema=value_schema,
        clearable=clearable,
        choices=choices,
        data_url=data_url,
    )


def _describe_props(props: dict[str, Any]) -> dict[str, Any]:
    """Convert a command's arguments to JSON, dropping the ones left unset.

    An absent parameter is omitted rather than reported as null, at any depth.
    That matters most for a nested parameter object: the column type helpers
    build a full dict per column, so a `column_config` arrives carrying
    `"width": null, "help": null, "disabled": null, ...` for everything the
    author did not set, which would make it one of the largest parts of a
    snapshot.

    A caller that wants to say something with `None` has to say it another way,
    which Streamlit already does: `column_config={"Notes": None}` means hidden,
    and is reported as `{"hidden": true}`. A prop that is the element's content
    rather than a parameter object is wrapped in `Content` and kept whole.
    """
    return {
        name: _prop_value(value) for name, value in props.items() if value is not None
    }


def _prop_value(value: Any) -> Any:
    """JSON for one prop.

    ``Content`` is the element's body, so a null inside it stays. Every other
    value drops entries that were ``None`` before encoding. A NaN that encodes
    as null stays, because that null is the value, not an unset parameter.
    """
    from streamlit.runtime.agent import json_encoding

    if isinstance(value, Content):
        return json_encoding.to_json_value(value.value)
    return json_encoding.to_json_value(_omit_unset(value))


def _omit_unset(value: Any, seen: set[int] | None = None) -> Any:
    """Copy ``value`` with dict entries that are ``None`` removed.

    A container already on the stack is left as-is. ``to_json_value`` turns that
    cycle into text, so this walk cannot recurse on a self-referential prop.
    """
    if not isinstance(value, (dict, list, tuple)):
        return value
    if seen is None:
        seen = set()
    marker = id(value)
    if marker in seen:
        return value
    seen.add(marker)
    try:
        if isinstance(value, dict):
            return {
                key: _omit_unset(item, seen)
                for key, item in value.items()
                if item is not None
            }
        if isinstance(value, list):
            return [None if item is None else _omit_unset(item, seen) for item in value]
        return tuple(
            None if item is None else _omit_unset(item, seen) for item in value
        )
    finally:
        seen.remove(marker)


class Content(NamedTuple):
    """A prop that is the element's content, reported exactly as given.

    A null inside `st.json`'s body or a custom component's arguments is part of
    what the author wrote, not an unset parameter, so it is not pruned.
    """

    value: Any


def vega_arrow_buffers(proto: VegaLiteChartProto) -> list[bytes]:
    """Every Arrow buffer a Vega-Lite chart's data is split across.

    Inline data and named datasets are both Arrow. The built-in charts and a
    single-dataframe Altair chart have one; Altair gives each dataframe in a
    layered or concatenated chart its own named dataset. Only a single buffer
    is served or previewed: several cannot be described as one table, and
    serving just the first would claim ``complete`` while leaving the rest out,
    so callers report several as unavailable instead.
    """
    buffers = [proto.data.data] if proto.data.data else []
    buffers.extend(dataset.data.data for dataset in proto.datasets if dataset.data.data)
    return buffers


def vega_loads_from_url(spec: Any) -> bool:
    """Whether a Vega-Lite specification loads any of its data from a URL.

    Checked at any depth: the top level, a layer, or a ``lookup``'s
    ``from.data``, but not inside inline rows or ``usermeta``. The browser
    fetches that data itself, so no Arrow buffer holds all of the chart's data.
    ``spec`` is the parsed specification or its JSON text; malformed text loads
    nothing.
    """
    if isinstance(spec, str):
        try:
            spec = json.loads(spec)
        except ValueError:
            return False
    return _loads_from_url(spec)


# Keys whose values hold inline rows or arbitrary author metadata, never a data
# source, so a nested `{"data": {"url": ...}}` there loads nothing.
_NOT_DATA_SOURCES: Final = frozenset({"datasets", "usermeta", "values"})


def _loads_from_url(value: Any) -> bool:
    if isinstance(value, dict):
        data = value.get("data")
        if isinstance(data, dict) and "url" in data:
            return True
        return any(
            _loads_from_url(item)
            for key, item in value.items()
            if key not in _NOT_DATA_SOURCES
        )
    if isinstance(value, list):
        return any(_loads_from_url(item) for item in value)
    return False


def block(
    command: str,
    /,
    *,
    key: str | None = None,
    action: ActionKind | None = None,
    value_schema: dict[str, Any] | None = None,
    support: SupportReason | None = None,
    transparent: bool = False,
    choices: list[Any] | None = None,
    **props: Any,
) -> str | None:
    """Describe a container for the agent API, or return ``None`` when this session is not recording.

    ``transparent`` marks an internal wrapper with no public counterpart, whose
    children belong to the parent container.

    ``action`` and ``value_schema`` are for a container that is a widget in its
    own right, such as ``st.tabs(on_change="rerun")``, whose value is the open
    tab. ``choices`` is the list a request may send when that list is not an
    ``options`` parameter, such as the tab labels.
    """
    return _json_description(
        command,
        props,
        key=key,
        action=action,
        support=support,
        value_schema=value_schema,
        transparent=transparent,
        choices=choices,
    )


def decode(agent_props: Any) -> dict[str, Any]:
    """Decode a command's description. Malformed input is ignored."""
    if not isinstance(agent_props, str):
        return {}
    try:
        decoded = json.loads(agent_props)
    except json.JSONDecodeError:
        return {}
    return decoded if isinstance(decoded, dict) else {}
