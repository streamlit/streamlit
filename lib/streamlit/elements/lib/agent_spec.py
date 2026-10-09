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
            label=label,
            options=formatted_options,
            help=help,
            placeholder=placeholder,
            disabled=disabled,
            label_visibility=label_visibility,
            accept_new_options=accept_new_options,
        ),
    )

The element ``type`` is the command name and every keyword is one of the
command's own parameter names, so the description is written and reviewed by
whoever owns the command. Because it is built from the arguments rather than
from the proto, it carries what the proto cannot: the command's identity where
several commands share a payload, and parameters that never reach the wire.

Nothing is built unless the agent API is enabled -- ``element`` returns ``None``
and the caller passes that straight through -- so an ordinary server does no
work beyond one cached flag read per element.

Two things deliberately stay out of a command's description, because the command
cannot know them yet:

- ``value``, the widget's current value, which is only settled after the next
  run's callbacks and widget reconciliation.
- ``data``, the derived facts about a dataframe or chart (schema, row counts,
  bounded previews). Those are budget decisions, and only the serializer knows
  the response budget.

Both are filled in at snapshot time. That split is the same one the agent
protocol draws between ``props`` (how the element was built), ``value`` (what it
holds now), and ``data`` (what Streamlit derived).
"""

from __future__ import annotations

import json
from typing import Any, Final, Literal, NamedTuple

# What a client may do with an element on the next interaction. ``value`` means
# it holds a value that can be set; ``trigger`` means it can be fired once and
# resets afterwards. Omit it for a display element.
ActionKind = Literal["value", "trigger"]

# Why an element is not fully usable through the agent API. Omit it when the
# element is fully supported. ``browser_required``: what renders may differ from
# what is reported. ``read_only_in_v1``: what is reported is accurate, but some
# input the element accepts cannot be sent.
SupportReason = Literal[
    "browser_required",
    "read_only_in_v1",
]

# Keys the snapshot serializer owns. A command's props are nested under "props"
# so a parameter can never collide with one of them.
_TYPE_KEY: Final = "type"
_KEY_KEY: Final = "key"
_ACTION_KEY: Final = "action"
_SUPPORT_KEY: Final = "support"
_PROPS_KEY: Final = "props"
_TRANSPARENT_KEY: Final = "transparent"
_DATA_URL_KEY: Final = "data_url"
_DATA_SUMMARY_KEY: Final = "data_summary"


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

    The set is checked first: it is empty unless the API is on and has a
    session, so the normal case costs one truth test per element and never
    takes the config lock.
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
    extra: dict[str, Any] | None = None,
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
    if extra:
        description.update(extra)
    description[_PROPS_KEY] = _describe_props(props)
    return json.dumps(description)


def element(
    command: str,
    /,
    *,
    key: str | None = None,
    action: ActionKind | None = None,
    support: SupportReason | None = None,
    data_url: str | None = None,
    data_summary: dict[str, Any] | None = None,
    **props: Any,
) -> str | None:
    """Describe an element for the agent API, or return ``None`` when it is off.

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
    support
        Why the element is not fully usable, when it is not.
    data_url
        Where the element's complete data can be fetched, from
        ``data_offload.serve_arrow_over_http``. Reported under ``data`` rather
        than ``props``, because it describes the data rather than an argument
        the author passed.
    data_summary
        The element's ``data``, for a command whose payload does not carry its
        table, so the snapshot cannot derive it: ``st.map`` emits a generated
        Deck.gl specification. Built with ``snapshot.summarize_arrow``.
    props
        The command's parameters, under their public names. ``None`` values are
        dropped, so an unsupplied optional parameter is absent rather than null.
        Pass an effective value (``disabled=False``) for any parameter whose
        value changes what the element means, so "absent" is never ambiguous.
    """
    extra: dict[str, Any] = {}
    if data_url is not None:
        extra[_DATA_URL_KEY] = data_url
    if data_summary is not None:
        extra[_DATA_SUMMARY_KEY] = data_summary
    return _json_description(
        command, props, key=key, action=action, support=support, extra=extra
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
    value drops nulls at any depth, because those are unset parameters.
    """
    from streamlit.runtime.agent import json_encoding

    if isinstance(value, Content):
        return json_encoding.to_json_value(value.value)
    return _drop_unset(json_encoding.to_json_value(value))


class Content(NamedTuple):
    """A prop that is the element's content, reported exactly as given.

    A null inside `st.json`'s body or a custom component's arguments is part of
    what the author wrote, not an unset parameter, so it is not pruned.
    """

    value: Any


def proto_alt(proto: Any) -> str | None:
    """The `alt` an element was given, as its proto carries it, or None.

    Read from the proto because that is where each command's normalization has
    already landed, and checked for presence because `""` is a real value: it
    marks an image as decorative.
    """
    return proto.alt if proto.HasField("alt") else None


def vega_arrow_buffers(proto: Any) -> list[bytes]:
    """Every Arrow buffer a Vega-Lite chart's data is split across.

    Inline data and named datasets are both Arrow. The built-in charts and a
    single-dataframe Altair chart have one; Altair gives each dataframe in a
    layered or concatenated chart its own named dataset. Only a single buffer
    is served or previewed: several cannot be described as one table, and
    serving just the first would claim `complete` while leaving the rest out,
    so callers report several as unavailable instead.
    """
    buffers = [proto.data.data] if proto.data.data else []
    buffers.extend(dataset.data.data for dataset in proto.datasets)
    return buffers


def described_column_config(column_config_mapping: Any) -> Any:
    """Describe a column configuration from the mapping Streamlit resolved.

    The resolved mapping is the better source than the author's argument: it has
    defaults applied, and it already states "hide this column" as
    `{"hidden": True}` rather than as the bare `None` the author may have
    written -- so no null in it carries meaning, and every remaining one can be
    dropped as unset.

    The index entry is removed, because its key is an internal identifier and
    `hide_index` is reported as a parameter in its own right. So is each
    column's presentation -- its width, pinning, and alignment -- which, like
    geometry everywhere else in the snapshot, means nothing to a non-visual
    client.
    """
    if not isinstance(column_config_mapping, dict):
        return column_config_mapping

    from streamlit.elements.lib.column_config_utils import INDEX_IDENTIFIER

    return {
        name: {
            key: value
            for key, value in config.items()
            if key not in _COLUMN_PRESENTATION_KEYS
        }
        if isinstance(config, dict)
        else config
        for name, config in column_config_mapping.items()
        if name != INDEX_IDENTIFIER
    } or None


_COLUMN_PRESENTATION_KEYS: Final = frozenset({"width", "pinned", "alignment"})


def _drop_unset(value: Any) -> Any:
    if isinstance(value, dict):
        return {
            key: _drop_unset(item) for key, item in value.items() if item is not None
        }
    if isinstance(value, list):
        # Positions in a list are meaningful, so a null stays a null.
        return [_drop_unset(item) for item in value]
    return value


def block(
    command: str,
    /,
    *,
    key: str | None = None,
    action: ActionKind | None = None,
    support: SupportReason | None = None,
    transparent: bool = False,
    **props: Any,
) -> str | None:
    """Describe a container for the agent API, or return ``None`` when it is off.

    ``transparent`` marks an internal wrapper with no public counterpart, whose
    children belong to the parent container.

    ``action`` is for a container that is a widget in its own right, such as
    ``st.tabs(on_change="rerun")``, whose value is the open tab.
    """
    extra = {_TRANSPARENT_KEY: True} if transparent else None
    return _json_description(
        command, props, key=key, action=action, support=support, extra=extra
    )


def decode(agent_props: str) -> dict[str, Any]:
    """Decode a command's description. Malformed input is ignored."""
    try:
        decoded = json.loads(agent_props)
    except json.JSONDecodeError:
        return {}
    return decoded if isinstance(decoded, dict) else {}
