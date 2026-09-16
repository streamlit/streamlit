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
            index=index,
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
from typing import Any, Final, Literal

from streamlit import config

# What a client may do with an element on the next interaction. ``value`` means
# it holds a value that can be set; ``trigger`` means it can be fired once and
# resets afterwards. Omit it for a display element.
ActionKind = Literal["value", "trigger"]

# Why an element is not fully usable through the agent API. Omit it when the
# element is fully supported.
SupportReason = Literal[
    "browser_required",
    "read_only_in_v1",
    "not_interactive_in_v1",
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


# Sessions created by the agent API. The registry that creates them owns this
# set, so "is this an agent session" is answerable on the script thread, where
# only the session id is at hand.
_AGENT_SESSION_IDS: Final[set[str]] = set()


def register_agent_session(session_id: str) -> None:
    """Mark a session as driven by the agent API."""
    _AGENT_SESSION_IDS.add(session_id)


def forget_agent_session(session_id: str) -> None:
    """Forget a closed agent session."""
    _AGENT_SESSION_IDS.discard(session_id)


def is_recording() -> bool:
    """True when the command being run should describe itself for the agent API.

    Gated per session, not just per server: only a session the agent API
    created records. A browser session sharing an agent-enabled server builds
    nothing, so its messages never carry a description and there is nothing to
    strip on the way out.

    Two cheap checks in the order that fails fastest. On a server with the API
    off -- the normal case -- this is one cached config read per element.
    """
    if not config.get_option("server.enableAgentApi"):
        return False
    if not _AGENT_SESSION_IDS:
        return False

    from streamlit.runtime.scriptrunner_utils.script_run_context import (
        get_script_run_ctx,
    )

    ctx = get_script_run_ctx()
    return ctx is not None and ctx.session_id in _AGENT_SESSION_IDS


def element(
    command: str,
    /,
    *,
    key: str | None = None,
    action: ActionKind | None = None,
    support: SupportReason | None = None,
    data_url: str | None = None,
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
        The element's ID. The snapshot reports the author's ``key=`` when there
        is one and falls back to this otherwise.
    action
        Whether the element holds a value that can be set or is a trigger that
        can be fired. Omit for display elements.
    support
        Why the element is not fully usable, when it is not.
    data_url
        Where the element's complete data can be fetched, from
        ``data_offload.serve_arrow_over_http``. Reported under ``data`` rather
        than ``props``, because it is a fact about the data rather than
        something the author wrote.
    props
        The command's parameters, under their public names. ``None`` values are
        dropped, so an unsupplied optional parameter is absent rather than null.
        Pass an effective value (``disabled=False``) for any parameter whose
        value changes what the element means, so "absent" is never ambiguous.
    """
    if not is_recording():
        return None

    from streamlit.runtime.agent import json_encoding

    description: dict[str, Any] = {_TYPE_KEY: command}
    if key is not None:
        description[_KEY_KEY] = key
    if action is not None:
        description[_ACTION_KEY] = action
    if support is not None:
        description[_SUPPORT_KEY] = support
    if data_url is not None:
        description[_DATA_URL_KEY] = data_url
    description[_PROPS_KEY] = {
        name: json_encoding.to_json_value(value)
        for name, value in props.items()
        if value is not None
    }
    return json.dumps(description)


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
    if not is_recording():
        return None

    from streamlit.runtime.agent import json_encoding

    description: dict[str, Any] = {_TYPE_KEY: command}
    if key is not None:
        description[_KEY_KEY] = key
    if action is not None:
        description[_ACTION_KEY] = action
    if support is not None:
        description[_SUPPORT_KEY] = support
    if transparent:
        description[_TRANSPARENT_KEY] = True
    description[_PROPS_KEY] = {
        name: json_encoding.to_json_value(value)
        for name, value in props.items()
        if value is not None
    }
    return json.dumps(description)


def decode(agent_props: str) -> dict[str, Any]:
    """Decode a command's description. Malformed input is ignored."""
    try:
        decoded = json.loads(agent_props)
    except json.JSONDecodeError:
        return {}
    return decoded if isinstance(decoded, dict) else {}
